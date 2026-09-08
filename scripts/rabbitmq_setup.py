"""
Idempotent RabbitMQ topology setup.
Run once per environment. Safe to re-run.
All names and settings from SPEC_02 Section 5.
"""
import asyncio
import logging
import os

import aio_pika

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EXCHANGES = [
    "procurement.org",
    "procurement.user",
    "procurement.audit",
    "procurement.master",
    "procurement.vendor",
    "procurement.pr",
    "procurement.unmapped",
    "procurement.rfq",
    "procurement.bid",
    "procurement.evaluation",
    "procurement.award",
    "procurement.contract",
    "procurement.po",
    "procurement.grn",
    "procurement.invoice",
    "procurement.payment",
    "procurement.notification",
    "procurement.document",
    "procurement.workflow",
    "procurement.rules",
    "procurement.integration",
    "procurement.integration.inbound",
    "procurement.admin",
    "procurement.alert",
    "procurement.ticket",
    "procurement.dlx",
]

QUEUES = [
    ("q.notification.email", "procurement.notification", "notification.email.*"),
    ("q.notification.sms", "procurement.notification", "notification.sms.*"),
    ("q.notification.inapp", "procurement.notification", "notification.inapp.*"),
    ("q.notification.digest", "procurement.notification", "notification.digest.*"),
    ("q.integration.erp.outbound", "procurement.integration", "integration.erp.*"),
    ("q.integration.hrms", "procurement.integration.inbound", "hrms.*"),
    ("q.vendor.lifecycle", "procurement.vendor", "vendor.*"),
    ("q.rfq.lifecycle", "procurement.rfq", "rfq.*"),
    ("q.bid.lifecycle", "procurement.bid", "bid.*"),
    ("q.workflow.events", "procurement.workflow", "workflow.*"),
    ("q.alert.critical", "procurement.alert", "alert.*"),
    ("q.audit.write", "procurement.audit", "audit.*"),
    ("q.ticket.events", "procurement.ticket", "ticket.*", "q.dlq.ticket"),
]

DLQ_TTL_MS = int(os.environ.get("DLQ_TTL_MS", "604800000"))


from dotenv import load_dotenv
load_dotenv()

async def setup_rabbitmq() -> None:
    """Create all exchanges, queues, DLQs, and bindings idempotently."""
    url = os.environ.get(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2Fprocurement"
    )
    if "/procurement" in url and "%2Fprocurement" not in url:
        url = url.replace("/procurement", "/%2Fprocurement")
    connection = await aio_pika.connect_robust(url)


    async with connection:
        channel = await connection.channel()

        exchange_refs: dict[str, aio_pika.abc.AbstractExchange] = {}
        for ex_name in EXCHANGES:
            exchange = await channel.declare_exchange(
                ex_name, aio_pika.ExchangeType.TOPIC, durable=True
            )
            exchange_refs[ex_name] = exchange
            logger.info("Declared exchange: %s", ex_name)

        dlx = exchange_refs["procurement.dlx"]

        for item in QUEUES:
            queue_name, exchange_name, routing_key = item[0], item[1], item[2]
            dlq_name = item[3] if len(item) > 3 else f"q.dlq.{queue_name.removeprefix('q.')}"

            dlq = await channel.declare_queue(
                dlq_name,
                durable=True,
                arguments={"x-message-ttl": DLQ_TTL_MS},
            )
            await dlq.bind(dlx, routing_key=f"dlq.{queue_name}")
            logger.info("Declared DLQ: %s", dlq_name)

            queue = await channel.declare_queue(
                queue_name,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": "procurement.dlx",
                    "x-dead-letter-routing-key": f"dlq.{queue_name}",
                },
            )
            await queue.bind(exchange_refs[exchange_name], routing_key=routing_key)
            logger.info("Declared queue: %s → %s [%s]", queue_name, exchange_name, routing_key)

        logger.info(
            "RabbitMQ setup completed: %d exchanges, %d queues, %d DLQs",
            len(EXCHANGES),
            len(QUEUES),
            len(QUEUES),
        )


if __name__ == "__main__":
    asyncio.run(setup_rabbitmq())
