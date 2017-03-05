##!/usr/bin/bash

# clean up
rm ./downloaded.png

token="5b1278ae830259d5dd42bec6154bdf68f42eed30"

echo "upload"
../bin/ezcp ./logo.png  $token

echo "download"
../bin/ezcp $token ./downloaded.png

