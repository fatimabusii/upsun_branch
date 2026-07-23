package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strconv"
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
	pathways   = []string{"Self-Screen", "Correctional Services", "Community Health", "Outpatient Clinic", "Workplace Wellness"}
	provinces  = []string{"Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"}
	ageGroups  = []string{"12-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"}
	genders    = []string{"Female", "Male", "Other / Prefer not to say"}
	substances = []string{"Alcohol", "Tobacco", "Cannabis", "Cocaine", "Amphetamines", "Sedatives", "Opioids", "Inhalants", "Hallucinogens"}
	riskLevels = []string{"Low", "Moderate", "High"}
	monthNames = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

	geoCentroids = map[string][2]float64{
		"Western Cape":  {-33.2, 21.0},
		"Gauteng":       {-26.2, 28.0},
		"KwaZulu-Natal": {-29.0, 30.5},
		"Eastern Cape":  {-32.3, 26.4},
		"Free State":    {-28.5, 26.8},
		"Limpopo":       {-23.4, 29.4},
		"Mpumalanga":    {-25.5, 30.5},
		"North West":    {-26.0, 25.5},
		"Northern Cape": {-29.0, 21.8},
		"Zimbabwe":      {-19.0, 29.8},
		"Namibia":       {-22.6, 17.1},
		"Botswana":      {-22.3, 24.7},
		"Mozambique":    {-18.7, 35.5},
		"Kenya":         {-0.02, 37.9},
		"Nigeria":       {9.1, 8.7},
		"Brazil":        {-10.3, -53.2},
		"Mexico":        {23.6, -102.5},
		"India":         {20.6, 78.9},
		"Philippines":   {12.9, 121.8},
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

// scopeRecords narrows the full dataset by tier scope BEFORE anything
// is returned. This is where the real Tier B/C data boundary lives —
// the browser never sees rows outside the persona's scope.
func scopeRecords(all []Record, scopeType, scopeValue string) []Record {
	if scopeType == "" || scopeValue == "" {
		return all
	}
	out := make([]Record, 0, len(all))
	for _, rec := range all {
		switch scopeType {
		case "country":
			if rec.Country == scopeValue {
				out = append(out, rec)
			}
		case "region":
			if rec.Region == scopeValue {
				out = append(out, rec)
			}
		}
	}
	return out
}

// ---- Aggregation types returned by /api/summary. Shapes intentionally
// match what the frontend chart-widget expects (labels + values, or
// labels + series), so the Overview/Substances/etc. pages can drop them
// straight into <chart-widget :data="...">.

type LabelValuesInt struct {
	Labels []string `json:"labels"`
	Values []int    `json:"values"`
}

type LabelValuesFloat struct {
	Labels []string  `json:"labels"`
	Values []float64 `json:"values"`
}

type Series struct {
	Name   string `json:"name"`
	Values []int  `json:"values"`
}

type LabelSeries struct {
	Labels []string `json:"labels"`
	Series []Series `json:"series"`
}

type MapLocation struct {
	Name  string  `json:"name"`
	Count int     `json:"count"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
}

type Kpis struct {
	TotalScreenings int    `json:"totalScreenings"`
	CountriesActive int    `json:"countriesActive"`
	HighRiskCount   int    `json:"highRiskCount"`
	TopSubstance    string `json:"topSubstance"`
}

type FunnelStage struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

type FunnelStages struct {
	SelfScreen   []FunnelStage `json:"selfScreen"`
	Practitioner []FunnelStage `json:"practitioner"`
}

type Summary struct {
	Kpis                 Kpis             `json:"kpis"`
	RiskDistribution     LabelValuesInt   `json:"riskDistribution"`
	SubstanceVolume      LabelValuesInt   `json:"substanceVolume"`
	SubstanceHighRiskPct LabelValuesFloat `json:"substanceHighRiskPct"`
	RiskBySubstance      LabelSeries      `json:"riskBySubstance"`
	AgeGroup             LabelValuesInt   `json:"ageGroup"`
	Gender               LabelValuesInt   `json:"gender"`
	MonthlyTrend         LabelSeries      `json:"monthlyTrend"`
	MapLocations         []MapLocation    `json:"mapLocations"`
	Funnel               FunnelStages     `json:"funnel"`
	Narrative            string           `json:"narrative"`
}

func countBy(recs []Record, keyOf func(Record) string) LabelValuesInt {
	counts := map[string]int{}
	for _, r := range recs {
		k := keyOf(r)
		if k == "" {
			continue
		}
		counts[k]++
	}
	labels := make([]string, 0, len(counts))
	for k := range counts {
		labels = append(labels, k)
	}
	sort.Strings(labels)
	values := make([]int, len(labels))
	for i, l := range labels {
		values[i] = counts[l]
	}
	return LabelValuesInt{Labels: labels, Values: values}
}

func pct(part, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(int(float64(part)/float64(total)*1000+0.5)) / 10
}

// buildSummary runs every aggregation the Public-tier pages need, once,
// server-side. Nothing row-level is returned — only counts, %, and
// pre-shaped chart data.
func buildSummary(recs []Record) Summary {
	// KPIs
	countrySet := map[string]bool{}
	highRisk := 0
	for _, r := range recs {
		countrySet[r.Country] = true
		if r.RiskLevel == "High" {
			highRisk++
		}
	}
	subVol := countBy(recs, func(r Record) string { return r.Substance })
	topSubstance := "—"
	if len(subVol.Labels) > 0 {
		maxIdx := 0
		for i, v := range subVol.Values {
			if v > subVol.Values[maxIdx] {
				maxIdx = i
			}
		}
		topSubstance = subVol.Labels[maxIdx]
	}

	// Risk distribution — ordered Low → Moderate → High for clarity
	riskOrder := []string{"Low", "Moderate", "High"}
	riskCounts := map[string]int{}
	for _, r := range recs {
		riskCounts[r.RiskLevel]++
	}
	riskDist := LabelValuesInt{Labels: riskOrder, Values: make([]int, len(riskOrder))}
	for i, l := range riskOrder {
		riskDist.Values[i] = riskCounts[l]
	}

	// % high-risk per substance
	highRiskPct := LabelValuesFloat{Labels: subVol.Labels, Values: make([]float64, len(subVol.Labels))}
	for i, s := range subVol.Labels {
		var subRecs int
		var subHigh int
		for _, r := range recs {
			if r.Substance == s {
				subRecs++
				if r.RiskLevel == "High" {
					subHigh++
				}
			}
		}
		highRiskPct.Values[i] = pct(subHigh, subRecs)
	}

	// Risk by substance — stacked series
	rbs := LabelSeries{Labels: subVol.Labels, Series: make([]Series, len(riskOrder))}
	for i, lvl := range riskOrder {
		vals := make([]int, len(subVol.Labels))
		for j, s := range subVol.Labels {
			for _, r := range recs {
				if r.Substance == s && r.RiskLevel == lvl {
					vals[j]++
				}
			}
		}
		rbs.Series[i] = Series{Name: lvl, Values: vals}
	}

	// Demographics
	ageDist := countBy(recs, func(r Record) string { return r.AgeGroup })
	genderDist := countBy(recs, func(r Record) string { return r.Gender })

	// Monthly trend — Total + Completed
	total := make([]int, 12)
	completed := make([]int, 12)
	for _, r := range recs {
		t, err := time.Parse("2006-01-02", r.Date)
		if err != nil {
			continue
		}
		m := int(t.Month()) - 1
		total[m]++
		if r.Completed {
			completed[m]++
		}
	}
	monthly := LabelSeries{
		Labels: monthNames,
		Series: []Series{{Name: "Total", Values: total}, {Name: "Completed", Values: completed}},
	}

	// Map locations — country-level only for the public summary
	countryCounts := countBy(recs, func(r Record) string { return r.Country })
	locations := make([]MapLocation, 0, len(countryCounts.Labels))
	for i, name := range countryCounts.Labels {
		if c, ok := geoCentroids[name]; ok {
			locations = append(locations, MapLocation{Name: name, Count: countryCounts.Values[i], Lat: c[0], Lng: c[1]})
		}
	}

	// Funnel stages
	var selfStarted, selfCompleted, practStarted, practCompleted int
	for _, r := range recs {
		if r.ScreeningMode == "Self-Screen" {
			selfStarted++
			if r.Completed {
				selfCompleted++
			}
		} else {
			practStarted++
			if r.Completed {
				practCompleted++
			}
		}
	}

	// Narrative
	narrative := "No screenings match the current scope."
	if len(recs) > 0 {
		assessmentCount := countDistinctAssessments(recs)
		narrative = "Within the current scope, " +
			strconv.Itoa(assessmentCount) + " screenings were completed. " +
			topSubstance + " was the most commonly screened substance, and " +
			strconv.FormatFloat(pct(highRisk, len(recs)), 'f', -1, 64) + "% of substance results were classified high-risk."
	}

	return Summary{
		Kpis: Kpis{
			TotalScreenings: countDistinctAssessments(recs),
			CountriesActive: len(countrySet),
			HighRiskCount:   highRisk,
			TopSubstance:    topSubstance,
		},
		RiskDistribution:     riskDist,
		SubstanceVolume:      subVol,
		SubstanceHighRiskPct: highRiskPct,
		RiskBySubstance:      rbs,
		AgeGroup:             ageDist,
		Gender:               genderDist,
		MonthlyTrend:         monthly,
		MapLocations:         locations,
		Funnel: FunnelStages{
			SelfScreen:   []FunnelStage{{Label: "Started", Value: selfStarted}, {Label: "Completed", Value: selfCompleted}},
			Practitioner: []FunnelStage{{Label: "Started", Value: practStarted}, {Label: "Completed", Value: practCompleted}},
		},
		Narrative: narrative,
	}
}

func recordsHandler(w http.ResponseWriter, r *http.Request) {
	scopeType := r.URL.Query().Get("scope_type")
	scopeValue := r.URL.Query().Get("scope_value")
	writeJSON(w, scopeRecords(records, scopeType, scopeValue))
}

func summaryHandler(w http.ResponseWriter, r *http.Request) {
	scopeType := r.URL.Query().Get("scope_type")
	scopeValue := r.URL.Query().Get("scope_value")
	writeJSON(w, buildSummary(scopeRecords(records, scopeType, scopeValue)))
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
		"regions":             regionSet,
		"countriesByRegion":   countriesByRegion,
		"provincesByCountry":  provincesByCountry,
		"substances":          substances,
		"ageGroups":           ageGroups,
		"genders":             genders,
		"riskLevels":          riskLevels,
		"screeningModes":      []string{"Self-Screen", "Practitioner-Assisted"},
		"screeningVersions":   []string{"Adult", "Adolescent"},
		"monthNames":          monthNames,
		"geoCentroids":        locations,
		"dateMin":             "2023-01-01",
		"dateMax":             "2023-12-31",
		"activePractitioners": numPractitioners,
	})
}

func registerAPIRoutes() {
	generateRecords()
	maybeLoadRealData()
	http.HandleFunc("/api/records", recordsHandler)
	http.HandleFunc("/api/meta", metaHandler)
	http.HandleFunc("/api/summary", summaryHandler)
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
