package lib

// Check - display error
func Check(e error) {
	if e != nil {
		panic(e)
	}
}
