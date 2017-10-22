#!/bin/sh
npm install --quiet
NODE_ENV=test npm run coveralls
