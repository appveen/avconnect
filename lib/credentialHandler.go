package lib

import (
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/AlecAivazis/survey"
	"github.com/fatih/color"
)

// CredentialHandler asd
type CredentialHandler struct {
}

func (ch *CredentialHandler) getCredentials() {
	fmt.Println(color.YellowString("Unable to find a credentials file!"))
	fmt.Println("Please provide the following details - ")
	var qs = []*survey.Question{
		{
			Name:     "accessKey",
			Prompt:   &survey.Input{Message: "AWS access key ID:"},
			Validate: survey.Required,
		},
		{
			Name:     "secretKey",
			Prompt:   &survey.Input{Message: "AWS secret access key:"},
			Validate: survey.Required,
		},
	}

	answers := struct {
		AccessKey string
		SecretKey string
	}{}

	// perform the questions
	err := survey.Ask(qs, &answers)
	Check(err)

	homeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	credentialsFile := path.Join(homeDir, "credentials")

	file, err := os.Create(credentialsFile)
	defer file.Close()
	file.WriteString("[default]\n")
	file.WriteString("aws_access_key_id = " + answers.AccessKey + "\n")
	file.WriteString("aws_secret_access_key = " + answers.SecretKey + "\n")
	file.Sync()
}

// InitCreds - Initializes the credentials. If the credentials are not found
// ask the user for the AWS access key and token.
func (ch *CredentialHandler) InitCreds() bool {
	if _, err := os.Stat("credentials"); os.IsNotExist(err) {
		ch.getCredentials()
	}
	return true
}
