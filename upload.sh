#!/bin/sh

echo 'Start uploading...'
gsutil -m rsync -r -x ".git/*|upload.sh" ./ gs://app.imversed.com/flow-plugins
echo 'Finish uploading.'