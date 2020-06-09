package lib

import (
	"bufio"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"../data"

	"github.com/AlecAivazis/survey"
	"github.com/fatih/color"
)

// RegionHandler asd
type RegionHandler struct{}

func (rh *RegionHandler) setRegion() {
	fmt.Println(color.YellowString("AWS region not set."))

	var prompt = &survey.Select{
		Message: "Select your region ",
		Options: data.GetHoomanReadableRegionList(),
	}

	region := ""
	survey.AskOne(prompt, &region)

	if region == "" {
		panic("No region selected!")
	}

	region = data.GetRegionCode(region)

	homeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	configFile := path.Join(homeDir, "config")

	file, err := os.Create(configFile)
	Check(err)
	defer file.Close()
	file.WriteString(region)
	file.Sync()
}

func (rh *RegionHandler) getRegion() string {
	homeDir, _ := filepath.Abs(filepath.Dir(os.Args[0]))
	configFile := path.Join(homeDir, "config")
	file, err := os.Open(configFile)
	Check(err)
	scanner := bufio.NewScanner(file)
	scanner.Scan()
	region := scanner.Text()
	data.CheckRegionCode(region)
	fmt.Printf("Region: %s\n", color.GreenString(data.GetHoomanReadableRegionName(region)))
	return region
}

// InitRegion - region initialization
func (rh *RegionHandler) InitRegion() string {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println(r)
		}
	}()
	if _, err := os.Stat("config"); os.IsNotExist(err) {
		rh.setRegion()
	}
	return rh.getRegion()
}
