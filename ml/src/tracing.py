import os
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

def setup_tracing(app):
    resource = Resource(attributes={
        "service.name": "audium-ml"
    })
    
    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)
    
    otlp_exporter = OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
    )
    
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    
    # Instrument FastAPI automatically
    FastAPIInstrumentor.instrument_app(app)
    
    return trace.get_tracer(__name__)

# To use manual spans in application logic:
# tracer = trace.get_tracer(__name__)
# with tracer.start_as_current_span("cache_hit"):
#     pass
