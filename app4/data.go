package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"time"
)

// Record is the full row-level shape. The frontend loads the whole set
// once and filters/aggregates it client-side against the universal
// filter bar — appropriate at this dataset size (this wouldn't scale to
// millions of rows without server-side filtering, noted in the README).
type Record struct {
	ID               int    `json:"id"`
	Date             string `json:"date"`
	Region           string `json:"region"`
	Country          string `json:"country"`
	Province         string `json:"province"` // "" if not South Africa
	AgeGroup         string `json:"ageGroup"`
	Cohort           string `json:"cohort"`           // Adolescents / Adults / Older Adults
	ScreeningVersion string `json:"screeningVersion"` // Adult / Adolescent
	Gender           string `json:"gender"`
	ScreeningMode    string `json:"screeningMode"` // Self-Screen / Practitioner-Assisted
	Pathway          string `json:"pathway"`
	Substance        string `json:"substance"`
	RiskLevel        string `json:"riskLevel"`
	Intervention     string `json:"intervention"`
	PractitionerID   string `json:"practitionerId"`
	Completed        bool   `json:"completed"`
	Minutes          int    `json:"minutes"`
}

type countryDef struct {
	name   string
	region string
	weight int
}

var countryDefs = []countryDef{
	{"South Africa", "Africa", 40},
	{"Zimbabwe", "Africa", 6},
	{"Namibia", "Africa", 5},
	{"Botswana", "Africa", 5},
	{"Mozambique", "Africa", 5},
	{"Kenya", "Africa", 6},
	{"Nigeria", "Africa", 6},
	{"Brazil", "Americas", 7},
	{"Mexico", "Americas", 6},
	{"India", "Asia", 7},
	{"Philippines", "Asia", 7},
}

var (
	pathways    = []string{"Self-Screen", "Correctional Services", "Community Health", "Outpatient Clinic", "Workplace Wellness"}
	provinces   = []string{"Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"}
	ageGroups   = []string{"12-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"}
	genders     = []string{"Female", "Male", "Other / Prefer not to say"}
	substances  = []string{"Alcohol", "Tobacco", "Cannabis", "Cocaine", "Amphetamines", "Sedatives", "Opioids", "Inhalants", "Hallucinogens"}
	riskLevels  = []string{"Low", "Moderate", "High"}
	monthNames  = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

	geoCentroids = map[string][2]float64{
		"Western Cape":  {-33.2, 21.0},
		"Gauteng":        {-26.2, 28.0},
		"KwaZulu-Natal":  {-29.0, 30.5},
		"Eastern Cape":   {-32.3, 26.4},
		"Free State":     {-28.5, 26.8},
		"Limpopo":        {-23.4, 29.4},
		"Mpumalanga":     {-25.5, 30.5},
		"North West":     {-26.0, 25.5},
		"Northern Cape":  {-29.0, 21.8},
		"Zimbabwe":       {-19.0, 29.8},
		"Namibia":        {-22.6, 17.1},
		"Botswana":       {-22.3, 24.7},
		"Mozambique":     {-18.7, 35.5},
		"Kenya":          {-0.02, 37.9},
		"Nigeria":        {9.1, 8.7},
		"Brazil":         {-10.3, -53.2},
		"Mexico":         {23.6, -102.5},
		"India":          {20.6, 78.9},
		"Philippines":    {12.9, 121.8},
	}
)

var substanceRiskWeight = map[string][]float64{
	"Alcohol":       {0.40, 0.38, 0.22},
	"Tobacco":       {0.55, 0.32, 0.13},
	"Cannabis":      {0.50, 0.34, 0.16},
	"Cocaine":       {0.25, 0.35, 0.40},
	"Amphetamines":  {0.28, 0.34, 0.38},
	"Sedatives":     {0.45, 0.35, 0.20},
	"Opioids":       {0.20, 0.32, 0.48},
	"Inhalants":     {0.42, 0.36, 0.22},
	"Hallucinogens": {0.50, 0.32, 0.18},
}

func cohortFor(ageGroup string) string {
	switch ageGroup {
	case "12-17":
		return "Adolescents"
	case "65+":
		return "Older Adults"
	default:
		return "Adults"
	}
}

func screeningVersionFor(ageGroup string) string {
	if ageGroup == "12-17" {
		return "Adolescent"
	}
	return "Adult"
}

func interventionFor(risk string) string {
	switch risk {
	case "Low":
		return "Brief Advice"
	case "Moderate":
		return "Brief Intervention"
	default:
		return "Referral to Treatment"
	}
}

func screeningModeFor(pathway string) string {
	if pathway == "Self-Screen" {
		return "Self-Screen"
	}
	return "Practitioner-Assisted"
}

const numPractitioners = 45

var practitionerOnsetMonth []int
var records []Record

func weightedPick(items []string, weights []float64, r *rand.Rand) string {
	x := r.Float64()
	cum := 0.0
	for i, w := range weights {
		cum += w
		if x <= cum {
			return items[i]
		}
	}
	return items[len(items)-1]
}

func weightedCountryPick(r *rand.Rand) countryDef {
	total := 0
	for _, c := range countryDefs {
		total += c.weight
	}
	x := r.Intn(total)
	cum := 0
	for _, c := range countryDefs {
		cum += c.weight
		if x < cum {
			return c
		}
	}
	return countryDefs[0]
}

func sprintfPractitioner(n int) string {
	digits := "0123456789"
	tens := n / 10
	ones := n % 10
	return "P-" + string(digits[tens]) + string(digits[ones])
}

func generateRecords() {
	r := rand.New(rand.NewSource(42))

	practitionerOnsetMonth = make([]int, numPractitioners)
	for i := 0; i < numPractitioners; i++ {
		practitionerOnsetMonth[i] = (i * 12) / numPractitioners
	}

	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	n := 1800
	records = make([]Record, 0, n)

	for i := 1; i <= n; i++ {
		dayOffset := r.Intn(365)
		date := start.AddDate(0, 0, dayOffset)
		month := int(date.Month()) - 1

		cd := weightedCountryPick(r)
		province := ""
		if cd.name == "South Africa" {
			province = provinces[r.Intn(len(provinces))]
		}

		substance := substances[r.Intn(len(substances))]
		risk := weightedPick(riskLevels, substanceRiskWeight[substance], r)
		ageGroup := ageGroups[r.Intn(len(ageGroups))]
		pathway := pathways[r.Intn(len(pathways))]

		var eligible []int
		for p := 0; p < numPractitioners; p++ {
			if practitionerOnsetMonth[p] <= month {
				eligible = append(eligible, p)
			}
		}
		practitioner := eligible[r.Intn(len(eligible))]

		records = append(records, Record{
			ID:               i,
			Date:             date.Format("2006-01-02"),
			Region:           cd.region,
			Country:          cd.name,
			Province:         province,
			AgeGroup:         ageGroup,
			Cohort:           cohortFor(ageGroup),
			ScreeningVersion: screeningVersionFor(ageGroup),
			Gender:           genders[r.Intn(len(genders))],
			ScreeningMode:    screeningModeFor(pathway),
			Pathway:          pathway,
			Substance:        substance,
			RiskLevel:        risk,
			Intervention:     interventionFor(risk),
			PractitionerID:   sprintfPractitioner(practitioner),
			Completed:        r.Float64() < 0.86,
			Minutes:          4 + r.Intn(18),
		})
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func recordsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, records)
}

func metaHandler(w http.ResponseWriter, r *http.Request) {
	countriesByRegion := map[string][]string{}
	provincesByCountry := map[string][]string{}
	regionSet := []string{}
	seenRegion := map[string]bool{}

	for _, cd := range countryDefs {
		if !seenRegion[cd.region] {
			seenRegion[cd.region] = true
			regionSet = append(regionSet, cd.region)
		}
		countriesByRegion[cd.region] = append(countriesByRegion[cd.region], cd.name)
	}
	provincesByCountry["South Africa"] = provinces
	sort.Strings(regionSet)

	locations := map[string][2]float64{}
	for k, v := range geoCentroids {
		locations[k] = v
	}

	writeJSON(w, map[string]interface{}{
		"regions":            regionSet,
		"countriesByRegion":  countriesByRegion,
		"provincesByCountry": provincesByCountry,
		"substances":         substances,
		"ageGroups":          ageGroups,
		"genders":            genders,
		"riskLevels":         riskLevels,
		"screeningModes":     []string{"Self-Screen", "Practitioner-Assisted"},
		"screeningVersions":  []string{"Adult", "Adolescent"},
		"monthNames":         monthNames,
		"geoCentroids":       locations,
		"dateMin":            "2023-01-01",
		"dateMax":            "2023-12-31",
		"activePractitioners": numPractitioners,
	})
}

func registerAPIRoutes() {
	generateRecords()
	http.HandleFunc("/api/records", recordsHandler)
	http.HandleFunc("/api/meta", metaHandler)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8888"
	}
	registerAPIRoutes()
	fs := http.FileServer(http.Dir("./web"))
	http.Handle("/", fs)
	addr := "0.0.0.0:" + port
	http.ListenAndServe(addr, nil)
}
