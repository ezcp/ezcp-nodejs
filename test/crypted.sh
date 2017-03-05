##!/usr/bin/bash

# clean up
rm ./downloaded.png

echo "login"
../bin/ezcp --login 14e803c3b1cc2fc00aa6addc1e8d647631b45d2a82170f977e85cf25b9afa99e

echo "upload"
../bin/ezcp -x "pass" ./logo.png 

echo "download"
../bin/ezcp -x "pass" ./downloaded.png

