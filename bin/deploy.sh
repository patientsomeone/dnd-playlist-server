#!/bin/bash
if ! npm run start
then
    echo Failed to start react server
    exit 1
fi
