from __future__ import annotations
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from app.config import settings

def setup_telemetry(app) -> None:
    resource = Resource.create({"service.name": "procurement-portal"})
    
    sampler = TraceIdRatioBased(settings.OTEL_SAMPLING_RATE)
    # Note: custom sampler for ERROR spans would be implemented here in a full solution.
    
    provider = TracerProvider(resource=resource, sampler=sampler)
    
    exporter = OTLPSpanExporter(endpoint=f"http://{settings.JAEGER_HOST}:{settings.JAEGER_PORT}")
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)
    
    trace.set_tracer_provider(provider)
    
    FastAPIInstrumentor.instrument_app(app)
    # SQLAlchemyInstrumentor.instrument() # Assuming engine is passed
    RedisInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    CeleryInstrumentor().instrument()

def get_current_trace_id() -> str:
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        return format(span.get_span_context().trace_id, "032x")
    return ""
