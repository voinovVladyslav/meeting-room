FROM python:3.11.2-alpine

ENV PYTHONUNBUFFERED 1

EXPOSE 8000

WORKDIR /app

COPY ./ /app

RUN python -m venv /py && \
    /py/bin/pip install --upgrade pip && \
    apk add --update --no-cache postgresql-client  && \
    apk add --update --no-cache --virtual .tmp-build-deps \
    build-base postgresql-dev musl-dev zlib zlib-dev && \
    /py/bin/pip install -r requirements.txt && \
    apk del .tmp-build-deps

ENV PATH="/py/bin:$PATH"
