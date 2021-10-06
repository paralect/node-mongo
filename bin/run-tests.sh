#!/bin/sh
docker-compose -f docker-compose.tests.yml up --build --abort-on-container-exit --exit-code-from tests
