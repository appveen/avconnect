package main

import (
	"flag"
	"fmt"

	"./awslib"
	"./lib"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
)

func main() {
	var credentialHandler = lib.CredentialHandler{}
	var regionHandler = lib.RegionHandler{}
	credentialHandler.InitCreds()
	region := regionHandler.InitRegion()

	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Credentials: credentials.NewSharedCredentials("credentials", "default"),
	})

	if err != nil {
		panic("Error creating session")
	}

	reloadPtr := flag.Bool("r", false, "Reload server config")
	connectPtr := flag.Int("c", 0, "Quick connect")
	flag.Parse()
	fmt.Println("Reload:", *reloadPtr)
	fmt.Println("Connect:", *connectPtr)

	var ec2Instances = awslib.EC2{}
	ec2Instances.Init(sess, *reloadPtr, *connectPtr)
}
