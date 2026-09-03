from __future__ import annotations
import asyncio
from loguru import logger
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.config import settings
import aio_pika

engine = create_async_engine(settings.DATABASE_URL)
async_session = async_sessionmaker(engine)

async def publish_outbox_messages():
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        channel = await connection.channel()
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        return

    async with async_session() as session:
        try:
            # Claim PENDING messages
            stmt = text(f"""
                SELECT id, event_type, routing_key, payload 
                FROM outbox_messages 
                WHERE status = 'PENDING' 
                ORDER BY created_at ASC 
                LIMIT {settings.OUTBOX_BATCH_SIZE} 
                FOR UPDATE SKIP LOCKED
            """)
            result = await session.execute(stmt)
            messages = result.mappings().all()

            if not messages:
                await session.commit()
                return

            for msg in messages:
                try:
                    message_body = msg['payload'].encode()
                    # A simplistic publish logic (exchange depends on event_type context)
                    # We assume default exchange logic for outbox or specific exchanges
                    exchange_name = msg['routing_key'].split('.')[1] if '.' in msg['routing_key'] else "procurement.default"
                    exchange = await channel.get_exchange(exchange_name)
                    
                    await exchange.publish(
                        aio_pika.Message(body=message_body),
                        routing_key=msg['routing_key']
                    )
                    
                    update_stmt = text("UPDATE outbox_messages SET status = 'PUBLISHED', updated_at = NOW() WHERE id = :id")
                    await session.execute(update_stmt, {"id": msg['id']})
                except Exception as e:
                    logger.error(f"Failed to publish message {msg['id']}: {e}")
                    update_stmt = text(f"""
                        UPDATE outbox_messages 
                        SET retry_count = retry_count + 1, 
                            status = CASE WHEN retry_count + 1 >= {settings.OUTBOX_RETRY_MAX} THEN 'FAILED' ELSE 'PENDING' END,
                            updated_at = NOW()
                        WHERE id = :id
                    """)
                    await session.execute(update_stmt, {"id": msg['id']})
            
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Error in publish_outbox_messages: {e}")
        finally:
            await connection.close()
