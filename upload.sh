#!/bin/sh

echo 'Start uploading...'
gsutil rm -r gs://app.imversed.com/flow-plugins
gsutil -m rsync -r ./plugins gs://app.imversed.com/flow-plugins
echo 'Finish uploading.'
