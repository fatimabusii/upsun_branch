package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"sort"
	"time"
)

// AssessmentRecord mirrors the real assessment_detail / involvement_summary
// schema, extended with a few derived fields (cohort, intervention level,
// practitioner) to support the Global Strategic Dashboard views.
type AssessmentRecord struct {
	ID             int    `json:"id"`
	Date           string `json:"date"` // YYYY-MM-DD
	Pathway        string `json:"pathway"`
	AssessType     string `json:"assessmentType"`
	Country        string `json:"country"`
	Province       string `json:"province"`
	AgeGroup       string `json:"ageGroup"`
	Cohort         string `json:"cohort"`
	Gender         string `json:"gender"`
	Substance      string `json:"substance"`
	RiskLevel      string `json:"riskLevel"`
	Intervention   string `json:"intervention"`
	PractitionerID string `json:"practitionerId"`
	Completed      bool   `json:"completed"`
	Minutes        int    `json:"minutes"`
}

var (
	pathways    = []string{"Self-Screen", "Correctional Services", "Community Health", "Outpatient Clinic", "Workplace Wellness"}
	assessTypes = []string{"Full Assessment", "Brief Screen"}
	countryPool = []string{
		"South Africa", "South Africa", "South Africa", "South Africa",
		"South Africa", "South Africa", "South Africa",
		"Zimbabwe", "Namibia", "Botswana", "Mozambique", "Kenya",
	}
	provinces  = []string{"Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"}
	ageGroups  = []string{"12-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"}
	genders    = []string{"Female", "Male", "Other / Prefer not to say"}
	substances = []string{"Alcohol", "Tobacco", "Cannabis", "Cocaine", "Amphetamines", "Sedatives", "Opioids", "Inhalants", "Hallucinogens"}
	riskLevels = []string{"Low", "Moderate", "High"}
	monthNames = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

	// Approximate centroids for the map view. Illustrative only — not
	// survey-grade GIS data, good enough for a demo bubble map.
	geoCentroids = map[string][2]float64{
		"Western Cape":   {-33.2, 21.0},
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

// cohortFor rolls the granular age brackets up into the 3 broad cohorts the
// client asked for. Our data starts at 12 (this is a screening tool, not a
// pediatric one), so "Children" isn't a bracket we have data for — the
// closest honest mapping is Adolescents / Adults / Older Adults.
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

// interventionFor maps risk level to a suggested intervention band,
// following the real ASSIST tool's intervention levels.
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

const numPractitioners = 45

var practitionerOnsetMonth []int // index = practitioner number, value = month (0-11) they went live

type AssessmentSet struct {
	Records []AssessmentRecord
}

var records []AssessmentRecord

func generateRecords() {
	r := rand.New(rand.NewSource(42))

	// Stagger practitioner onboarding across the year to produce a
	// realistic "platform adoption" growth curve.
	practitionerOnsetMonth = make([]int, numPractitioners)
	for i := 0; i < numPractitioners; i++ {
		practitionerOnsetMonth[i] = (i * 12) / numPractitioners
	}

	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	n := 1400
	records = make([]AssessmentRecord, 0, n)

	for i := 1; i <= n; i++ {
		dayOffset := r.Intn(365)
		date := start.AddDate(0, 0, dayOffset)
		month := int(date.Month()) - 1

		country := countryPool[r.Intn(len(countryPool))]
		province := "N/A"
		if country == "South Africa" {
			province = provinces[r.Intn(len(provinces))]
		}

		substance := substances[r.Intn(len(substances))]
		risk := weightedPick(riskLevels, substanceRiskWeight[substance], r)
		ageGroup := ageGroups[r.Intn(len(ageGroups))]

		// Only practitioners already onboarded by this record's month
		// can have produced it.
		var eligible []int
		for p := 0; p < numPractitioners; p++ {
			if practitionerOnsetMonth[p] <= month {
				eligible = append(eligible, p)
			}
		}
		practitioner := eligible[r.Intn(len(eligible))]

		records = append(records, AssessmentRecord{
			ID:             i,
			Date:           date.Format("2006-01-02"),
			Pathway:        pathways[r.Intn(len(pathways))],
			AssessType:     assessTypes[r.Intn(len(assessTypes))],
			Country:        country,
			Province:       province,
			AgeGroup:       ageGroup,
			Cohort:         cohortFor(ageGroup),
			Gender:         genders[r.Intn(len(genders))],
			Substance:      substance,
			RiskLevel:      risk,
			Intervention:   interventionFor(risk),
			PractitionerID: sprintfPractitioner(practitioner),
			Completed:      r.Float64() < 0.86,
			Minutes:        4 + r.Intn(18),
		})
	}
}

func sprintfPractitioner(n int) string {
	digits := "0123456789"
	s := "P-"
	tens := n / 10
	ones := n % 10
	s += string(digits[tens]) + string(digits[ones])
	return s
}

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

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type series struct {
	Labels []string  `json:"labels"`
	Values []float64 `json:"values"`
}

type multiSeries struct {
	Labels []string    `json:"labels"`
	Series []namedVals `json:"series"`
}

type namedVals struct {
	Name   string    `json:"name"`
	Values []float64 `json:"values"`
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}

func countBy(keyFn func(AssessmentRecord) string) (labels []string, values []float64) {
	counts := map[string]int{}
	for _, rec := range records {
		counts[keyFn(rec)]++
	}
	for k := range counts {
		labels = append(labels, k)
	}
	sort.Strings(labels)
	for _, l := range labels {
		values = append(values, float64(counts[l]))
	}
	return
}

// --- /api/summary ---
func summaryHandler(w http.ResponseWriter, r *http.Request) {
	total := len(records)
	countrySet := map[string]bool{}
	highRisk := 0
	completed := 0
	substanceCounts := map[string]int{}

	for _, rec := range records {
		countrySet[rec.Country] = true
		if rec.RiskLevel == "High" {
			highRisk++
		}
		if rec.Completed {
			completed++
		}
		substanceCounts[rec.Substance]++
	}

	topSubstance, topCount := "", -1
	for s, c := range substanceCounts {
		if c > topCount {
			topSubstance, topCount = s, c
		}
	}

	writeJSON(w, map[string]interface{}{
		"totalScreenings":     total,
		"countriesActive":     len(countrySet),
		"highRiskScreens":     highRisk,
		"topSubstance":        topSubstance,
		"completionRate":      round1(float64(completed) / float64(total) * 100),
		"activePractitioners": numPractitioners,
	})
}

// --- /api/geography (+ map locations) ---
func geographyHandler(w http.ResponseWriter, r *http.Request) {
	provLabels, provValues := countBy(func(a AssessmentRecord) string {
		if a.Province == "N/A" {
			return ""
		}
		return a.Province
	})
	cl, cv := []string{}, []float64{}
	for i, l := range provLabels {
		if l != "" {
			cl = append(cl, l)
			cv = append(cv, provValues[i])
		}
	}

	countryLabels, countryValues := countBy(func(a AssessmentRecord) string { return a.Country })

	// Flat location list for the map: SA provinces + other countries,
	// each with an approximate lat/lng and a screening count.
	type location struct {
		Name  string  `json:"name"`
		Lat   float64 `json:"lat"`
		Lng   float64 `json:"lng"`
		Count float64 `json:"count"`
	}
	locations := []location{}
	for i, name := range cl {
		if c, ok := geoCentroids[name]; ok {
			locations = append(locations, location{Name: name, Lat: c[0], Lng: c[1], Count: cv[i]})
		}
	}
	for i, name := range countryLabels {
		if name == "South Africa" {
			continue // already represented at province level
		}
		if c, ok := geoCentroids[name]; ok {
			locations = append(locations, location{Name: name, Lat: c[0], Lng: c[1], Count: countryValues[i]})
		}
	}

	writeJSON(w, map[string]interface{}{
		"provinces": series{Labels: cl, Values: cv},
		"countries": series{Labels: countryLabels, Values: countryValues},
		"locations": locations,
	})
}

// --- /api/demographics ---
func demographicsHandler(w http.ResponseWriter, r *http.Request) {
	ageLabels, ageValues := countBy(func(a AssessmentRecord) string { return a.AgeGroup })
	genderLabels, genderValues := countBy(func(a AssessmentRecord) string { return a.Gender })

	writeJSON(w, map[string]interface{}{
		"ageGroups": series{Labels: ageLabels, Values: ageValues},
		"genders":   series{Labels: genderLabels, Values: genderValues},
	})
}

// --- /api/risk: overall risk distribution (context for the Overview page) ---
func riskHandler(w http.ResponseWriter, r *http.Request) {
	overallLabels, overallValues := countBy(func(a AssessmentRecord) string { return a.RiskLevel })
	writeJSON(w, map[string]interface{}{
		"overall": series{Labels: overallLabels, Values: overallValues},
	})
}

// --- /api/cohorts ---
func cohortsHandler(w http.ResponseWriter, r *http.Request) {
	cohortOrder := []string{"Adolescents", "Adults", "Older Adults"}
	cohortLabels, cohortValues := countBy(func(a AssessmentRecord) string { return a.Cohort })

	byRisk := multiSeries{Labels: cohortOrder}
	for _, level := range riskLevels {
		vals := []float64{}
		for _, c := range cohortOrder {
			count := 0
			for _, rec := range records {
				if rec.Cohort == c && rec.RiskLevel == level {
					count++
				}
			}
			vals = append(vals, float64(count))
		}
		byRisk.Series = append(byRisk.Series, namedVals{Name: level, Values: vals})
	}

	writeJSON(w, map[string]interface{}{
		"totals": series{Labels: cohortLabels, Values: cohortValues},
		"byRisk": byRisk,
	})
}

// --- /api/sankey: Screening -> Risk Level -> Suggested Intervention ---
func sankeyHandler(w http.ResponseWriter, r *http.Request) {
	type node struct {
		Name string `json:"name"`
	}
	type link struct {
		Source int `json:"source"`
		Target int `json:"target"`
		Value  int `json:"value"`
	}

	nodes := []node{{"All Screenings"}}
	nodeIndex := map[string]int{"All Screenings": 0}
	for _, lvl := range riskLevels {
		nodeIndex[lvl] = len(nodes)
		nodes = append(nodes, node{lvl})
	}
	interventions := []string{"Brief Advice", "Brief Intervention", "Referral to Treatment"}
	for _, iv := range interventions {
		nodeIndex[iv] = len(nodes)
		nodes = append(nodes, node{iv})
	}

	riskCounts := map[string]int{}
	flowCounts := map[[2]string]int{}
	for _, rec := range records {
		riskCounts[rec.RiskLevel]++
		flowCounts[[2]string{rec.RiskLevel, rec.Intervention}]++
	}

	links := []link{}
	for _, lvl := range riskLevels {
		links = append(links, link{Source: nodeIndex["All Screenings"], Target: nodeIndex[lvl], Value: riskCounts[lvl]})
	}
	for _, lvl := range riskLevels {
		for _, iv := range interventions {
			v := flowCounts[[2]string{lvl, iv}]
			if v > 0 {
				links = append(links, link{Source: nodeIndex[lvl], Target: nodeIndex[iv], Value: v})
			}
		}
	}

	writeJSON(w, map[string]interface{}{"nodes": nodes, "links": links})
}

// --- /api/substance-trends: per-substance monthly time series ---
func substanceTrendsHandler(w http.ResponseWriter, r *http.Request) {
	ms := multiSeries{Labels: monthNames}
	for _, s := range substances {
		vals := make([]float64, 12)
		for _, rec := range records {
			if rec.Substance != s {
				continue
			}
			t, err := time.Parse("2006-01-02", rec.Date)
			if err != nil {
				continue
			}
			vals[int(t.Month())-1]++
		}
		ms.Series = append(ms.Series, namedVals{Name: s, Values: vals})
	}
	writeJSON(w, map[string]interface{}{"months": ms})
}

// --- /api/adoption: cumulative active practitioners per month ---
func adoptionHandler(w http.ResponseWriter, r *http.Request) {
	vals := make([]float64, 12)
	for m := 0; m < 12; m++ {
		count := 0
		for _, onset := range practitionerOnsetMonth {
			if onset <= m {
				count++
			}
		}
		vals[m] = float64(count)
	}
	writeJSON(w, map[string]interface{}{
		"months": multiSeries{Labels: monthNames, Series: []namedVals{{Name: "Active Practitioners", Values: vals}}},
	})
}

// --- /api/regional-concerns: simple month-over-month risk spike flagging ---
type regionalConcernRow struct {
	Province        string  `json:"province"`
	Month           string  `json:"month"`
	HighRiskPctThis float64 `json:"highRiskPctThisMonth"`
	HighRiskPctPrev float64 `json:"highRiskPctPrevMonth"`
	DeltaPoints     float64 `json:"deltaPoints"`
	ScreeningVolume int     `json:"screeningVolume"`
}

func regionalConcernsHandler(w http.ResponseWriter, r *http.Request) {
	// total + high-risk counts per province per month
	type key struct {
		province string
		month    int
	}
	total := map[key]int{}
	high := map[key]int{}

	for _, rec := range records {
		if rec.Province == "N/A" {
			continue
		}
		t, err := time.Parse("2006-01-02", rec.Date)
		if err != nil {
			continue
		}
		k := key{rec.Province, int(t.Month()) - 1}
		total[k]++
		if rec.RiskLevel == "High" {
			high[k]++
		}
	}

	rows := []regionalConcernRow{}
	for _, prov := range provinces {
		for m := 1; m < 12; m++ {
			thisKey := key{prov, m}
			prevKey := key{prov, m - 1}
			if total[thisKey] == 0 || total[prevKey] == 0 {
				continue
			}
			thisPct := round1(float64(high[thisKey]) / float64(total[thisKey]) * 100)
			prevPct := round1(float64(high[prevKey]) / float64(total[prevKey]) * 100)
			delta := round1(thisPct - prevPct)
			if delta >= 8 {
				rows = append(rows, regionalConcernRow{
					Province:        prov,
					Month:           monthNames[m],
					HighRiskPctThis: thisPct,
					HighRiskPctPrev: prevPct,
					DeltaPoints:     delta,
					ScreeningVolume: total[thisKey],
				})
			}
		}
	}

	sort.Slice(rows, func(i, j int) bool { return rows[i].DeltaPoints > rows[j].DeltaPoints })
	writeJSON(w, rows)
}

// --- /api/reports ---
type monthlyReportRow struct {
	Month          string  `json:"month"`
	Total          int     `json:"total"`
	Completed      int     `json:"completed"`
	CompletionRate float64 `json:"completionRate"`
	AvgMinutes     float64 `json:"avgMinutes"`
}

func reportsHandler(w http.ResponseWriter, r *http.Request) {
	rows := make([]monthlyReportRow, 12)
	minutesSum := make([]int, 12)
	for i := range rows {
		rows[i].Month = monthNames[i]
	}

	for _, rec := range records {
		t, err := time.Parse("2006-01-02", rec.Date)
		if err != nil {
			continue
		}
		m := int(t.Month()) - 1
		rows[m].Total++
		minutesSum[m] += rec.Minutes
		if rec.Completed {
			rows[m].Completed++
		}
	}

	for i := range rows {
		if rows[i].Total > 0 {
			rows[i].CompletionRate = round1(float64(rows[i].Completed) / float64(rows[i].Total) * 100)
			rows[i].AvgMinutes = round1(float64(minutesSum[i]) / float64(rows[i].Total))
		}
	}

	writeJSON(w, rows)
}

// --- /api/explorer ---
func explorerHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, records)
}

func registerAPIRoutes() {
	generateRecords()
	http.HandleFunc("/api/summary", summaryHandler)
	http.HandleFunc("/api/geography", geographyHandler)
	http.HandleFunc("/api/demographics", demographicsHandler)
	http.HandleFunc("/api/risk", riskHandler)
	http.HandleFunc("/api/cohorts", cohortsHandler)
	http.HandleFunc("/api/sankey", sankeyHandler)
	http.HandleFunc("/api/substance-trends", substanceTrendsHandler)
	http.HandleFunc("/api/adoption", adoptionHandler)
	http.HandleFunc("/api/regional-concerns", regionalConcernsHandler)
	http.HandleFunc("/api/reports", reportsHandler)
	http.HandleFunc("/api/explorer", explorerHandler)
}
