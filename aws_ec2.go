package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
)

// Server ad
type Server struct {
	No               int       `json:"no"`
	State            string    `json:"state"`
	Name             string    `json:"name"`
	PublicIPAddress  string    `json:"publicIpAddress"`
	PrivateIPAddress string    `json:"privateIpAddress"`
	User             string    `json:"user"`
	InstanceType     string    `json:"instanceType"`
	LaunchTime       time.Time `json:"launchTime"`
	InstanceID       string    `json:"instanceId"`
}

// EC2 asd
type EC2 struct{}

// the prompt
var qs = []*survey.Question{
	{
		Name:   "selection",
		Prompt: &survey.Input{Message: "Select server"},
	},
}

// Init alksdj
func (e *EC2) Init(sess *session.Session, reload bool, quickConnect int) {
	if _, err := os.Stat("servers.json"); os.IsNotExist(err) || reload {
		fmt.Println(color.YellowString("Fetching server list..."))
		fetchEC2Instances(sess)
	}

	skipDisplay := quickConnect > 0

	servers := displayServerList(skipDisplay)
	server := Server{}

	if !skipDisplay {
		answer := struct {
			Selection int
		}{}

		err := survey.Ask(qs, &answer)
		Check(err)
		fmt.Println(answer.Selection)
		server = servers[answer.Selection-1]
	} else if quickConnect > len(servers) {
		panic("Invalid server number")
	} else {
		server = servers[quickConnect-1]
	}

	cmd := exec.Command("ssh", "-i", "./av.pem", server.User+"@"+server.PublicIPAddress)
	fmt.Println(cmd)
	cmd.Stdout = os.Stdout
	cmd.Stdin = os.Stdin
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	Check(err)
}

func sortServers(servers []Server) []Server {
	serversList := []Server{}
	serversStarted := []Server{}
	serversStopped := []Server{}
	names := []string{}
	for _, server := range servers {
		names = append(names, server.Name+","+server.InstanceID)
	}
	sort.Strings(names)
	for _, name := range names {
		for _, server := range servers {
			if name == server.Name+","+server.InstanceID {
				serversList = append(serversList, server)
			}
		}
	}
	for _, server := range serversList {
		if server.State == "running" {
			serversStarted = append(serversStarted, server)
		} else {
			serversStopped = append(serversStopped, server)
		}
	}
	return append(serversStarted, serversStopped...)
}

func setColor(status string, s string) string {
	if status == "stopped" {
		return color.RedString(s)
	}
	if status == "terminated" {
		return color.WhiteString(s)
	}
	return s
}

func displayServerList(skipDisplay bool) []Server {
	homeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	serversJSON := path.Join(homeDir, "servers.json")
	file, err := os.Open(serversJSON)
	if err != nil {
		panic("Unable to read server list.")
	}
	scanner := bufio.NewScanner(file)
	scanner.Scan()
	servers := []Server{}
	json.Unmarshal(scanner.Bytes(), &servers)
	servers = sortServers(servers)
	if !skipDisplay {
		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{
			"#",
			"Name",
			"Type",
			"Public IP",
			"Private IP",
			"User",
		})
		table.SetHeaderColor(
			tablewriter.Color(tablewriter.FgYellowColor),
			tablewriter.Color(tablewriter.FgYellowColor),
			tablewriter.Color(tablewriter.FgYellowColor),
			tablewriter.Color(tablewriter.FgYellowColor),
			tablewriter.Color(tablewriter.FgYellowColor),
			tablewriter.Color(tablewriter.FgYellowColor),
		)
		table.SetRowLine(true)
		table.SetColumnSeparator("│")
		table.SetCenterSeparator("┼")
		table.SetRowSeparator("─")
		table.SetAutoFormatHeaders(false)
		table.SetReflowDuringAutoWrap(true)
		table.SetAutoWrapText(false)
		for i, server := range servers {
			table.Append([]string{
				setColor(server.State, strconv.Itoa(i+1)),
				server.Name,
				server.InstanceType,
				server.PublicIPAddress,
				server.PrivateIPAddress,
				server.User,
			})
		}
		table.Render()
	}
	return servers
}

// Ec2Init asd
func fetchEC2Instances(sess *session.Session) {
	svc := ec2.New(sess)
	input := &ec2.DescribeInstancesInput{}
	results, err := svc.DescribeInstances(input)
	Check(err)

	counter := 1

	servers := []Server{}

	for _, reservation := range results.Reservations {
		for _, instance := range reservation.Instances {
			server := Server{}
			server.No = counter
			server.State = *instance.State.Name
			server.InstanceType = *instance.InstanceType
			server.LaunchTime = *instance.LaunchTime
			server.PrivateIPAddress = *instance.PrivateIpAddress
			server.PublicIPAddress = "-"
			server.InstanceID = *instance.InstanceId
			if instance.PublicIpAddress != nil {
				server.PublicIPAddress = *instance.PublicIpAddress
			}
			for _, v := range instance.Tags {
				if *v.Key == "Name" {
					server.Name = *v.Value
				}
				if *v.Key == "User" {
					server.User = *v.Value
				}
			}
			servers = append(servers, server)
			counter++
		}
	}
	servers = sortServers(servers)
	s, _ := json.Marshal(servers)

	homeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	serversJSON := path.Join(homeDir, "servers.json")

	file, err := os.Create(serversJSON)
	defer file.Close()
	file.WriteString(string(s))
	file.Sync()
}
