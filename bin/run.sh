#!/bin/sh
npm install --quiet
Node_ENV=test npm run test:eslint
