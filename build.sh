rm -rf bin || true

echo "env GOOS=linux GOARCH=386 go build -ldflags="-s -w" -o bin/avconnect-linux-386 ."
env GOOS=linux GOARCH=386 go build -ldflags="-s -w" -o bin/avconnect-linux-386 .

echo "env GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/avconnect-linux-amd64 ."
env GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/avconnect-linux-amd64 .

echo "env GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/avconnect-mac ."
env GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/avconnect-mac .

cd bin || exit

md5sum avconnect-linux-386 > md5sum.txt
md5sum avconnect-linux-amd64 >> md5sum.txt
md5sum avconnect-mac >> md5sum.txt