#!/bin/sh
npm i --quiet
NODE_ENV=test npm run test:eslint
