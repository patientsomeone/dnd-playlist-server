#!/bin/bash
echo ----- PATIENT BUILD LOGS BEGIN -----

# Cleanup existing dist
echo Cleaning Dist
if ! rm -rf ./dist/*;
then
    echo ./dist/* does not exist
else 
    echo ./dist/* removed
fi

# Execute TSC
echo Executing TSC
if ! node_modules/.bin/tsc; then 
    echo TSC Build Failed
    exit 1
else 
    echo TSC Build Successful
fi

# Migrate /json
echo Executing TSC
if ! cp -r ./src/json ./dist/json; 
then 
    echo Failed to migrate /json
    exit 1
else 
    echo JSON Migration Successful
fi

# Migrate /logs
echo Executing TSC
if ! cp -r ./src/logs ./dist/logs; 
then 
    echo Failed to migrate /logs
    exit 1
else 
    echo Log Migration Successful
fi

echo Build Process Complete

echo ----- PATIENT BUILD LOGS END -----
