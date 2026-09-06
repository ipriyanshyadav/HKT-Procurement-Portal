from __future__ import annotations
import asyncio
import json
from loguru import logger
from sqlalchemy import text
from app.config import settings
from app.core.metrics import outbox_messages_pending
from app.db.session import async_session
from app.tasks.celery_app import celery_app
import aio_pika


async def publish_outbox_messages():
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        channel = await connection.channel()
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        return

    async with async_session() as session:
        try:
            # Query and record pending count gauge
            count_stmt = text("SELECT COUNT(*) FROM outbox_messages WHERE status = 'PENDING'")
            count_res = await session.execute(count_stmt)
            outbox_messages_pending.set(count_res.scalar() or 0)

            # Claim PENDING messages
            stmt = text("""
                SELECT id, exchange, routing_key, payload, headers 
                FROM outbox_messages 
                WHERE status = 'PENDING' 
                ORDER BY created_at ASC 
                LIMIT :batch_size 
                FOR UPDATE SKIP LOCKED
            """)
            result = await session.execute(stmt, {"batch_size": settings.OUTBOX_BATCH_SIZE})
            messages = result.mappings().all()

            if not messages:
                await session.commit()
                return

            for msg in messages:
                try:
                    payload = msg["payload"]
                    if isinstance(payload, dict):
                        message_body = json.dumps(payload).encode()
                    elif isinstance(payload, str):
                        message_body = payload.encode()
                    else:
                        message_body = json.dumps(payload).encode()

                    exchange_name = msg["exchange"] or "procurement.events"
                    exchange = await channel.declare_exchange(
                        exchange_name,
                        aio_pika.ExchangeType.TOPIC,
                        durable=True,
                    )

                    headers = msg["headers"] if isinstance(msg["headers"], dict) else {}
                    await exchange.publish(
                        aio_pika.Message(
                            body=message_body,
                            content_type="application/json",
                            headers=headers,
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        ),
                        routing_key=msg["routing_key"],
                    )

                    update_stmt = text(
                        "UPDATE outbox_messages SET status = 'PUBLISHED', published_at = NOW() WHERE id = :id"
                    )
                    await session.execute(update_stmt, {"id": msg["id"]})
                except Exception as e:
                    logger.error(f"Failed to publish message {msg['id']}: {e}")
                    update_stmt = text("""
                        UPDATE outbox_messages 
                        SET retry_count = retry_count + 1, 
                            last_error = :last_error,
                            status = CASE WHEN retry_count + 1 >= :retry_max THEN 'FAILED' ELSE 'PENDING' END
                        WHERE id = :id
                    """)
                    await session.execute(
                        update_stmt,
                        {"id": msg["id"], "last_error": str(e), "retry_max": settings.OUTBOX_RETRY_MAX},
                    )


            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Error in publish_outbox_messages: {e}")
        finally:
            await connection.close()


@celery_app.task(queue="maintenance", name="app.tasks.maintenance.publish_outbox")
def publish_outbox():
    """Celery task: poll outbox_messages and publish to RabbitMQ."""
    asyncio.run(publish_outbox_messages())
