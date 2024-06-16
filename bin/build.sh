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

echo Build Process Complete

echo ----- PATIENT BUILD LOGS END -----