package data

import "sort"

// RegionMap - used to find the actual region code.
var regionMap = map[string]string{
	"US East (Ohio): us-east-2":                   "us-east-2",
	"US East (N. Virginia): us-east-1":            "us-east-1",
	"US West (N. California): us-west-1":          "us-west-1",
	"US West (Oregon): us-west-2":                 "us-west-2",
	"Asia Pacific (Hong Kong): ap-east-1":         "ap-east-1",
	"Asia Pacific (Mumbai): ap-south-1 ":          "ap-south-1",
	"Asia Pacific (Osaka-Local): ap-northeast-3 ": "ap-northeast-3",
	"Asia Pacific (Seoul): ap-northeast-2 ":       "ap-northeast-2",
	"Asia Pacific (Singapore): ap-southeast-1 ":   "ap-southeast-1",
	"Asia Pacific (Sydney): ap-southeast-2 ":      "ap-southeast-2",
	"Asia Pacific (Tokyo): ap-northeast-1 ":       "ap-northeast-1",
	"Canada (Central): ca-central-1 ":             "ca-central-1",
	"China (Beijing): cn-north-1":                 "cn-north-1",
	"China (Ningxia): cn-northwest-1":             "cn-northwest-1",
	"EU (Frankfurt): eu-central-1 ":               "eu-central-1",
	"EU (Ireland): eu-west-1":                     "eu-west-1",
	"EU (London): eu-west-2":                      "eu-west-2",
	"EU (Paris): eu-west-3":                       "eu-west-3",
	"EU (Stockholm): eu-north-1":                  "eu-north-1",
	"South America (São Paulo): sa-east-1":        "sa-east-1",
	"AWS GovCloud (US-East): us-gov-east-1":       "us-gov-east-1",
	"AWS GovCloud (US): us-gov-west-1":            "us-gov-west-1",
}

// GetHoomanReadableRegionList for displaying in menu
func GetHoomanReadableRegionList() []string {
	regions := []string{}
	for k := range regionMap {
		regions = append(regions, k)
	}
	sort.Strings(regions)
	return regions
}

// GetHoomanReadableRegionName for displaying in menu
func GetHoomanReadableRegionName(_regionCode string) string {
	for k, v := range regionMap {
		if v == _regionCode {
			return k
		}
	}
	return _regionCode
}

// GetRegionCode - convert from hooman to machine
func GetRegionCode(_region string) string {
	return regionMap[_region]
}

// CheckRegionCode - check if the region code is valid
func CheckRegionCode(_regionCode string) bool {
	for _, v := range regionMap {
		if v == _regionCode {
			return true
		}
	}
	panic("Unsupported region :: " + _regionCode)
}
