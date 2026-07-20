package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"sort"
	"time"
)

// AssessmentRecord mirrors the shape of the real assessment_detail /
// involvement_summary data (simplified to one substance+risk per record,
// which is close enough for dashboard purposes).
type AssessmentRecord struct {
	ID         int    `json:"id"`
	Date       string `json:"date"` // YYYY-MM-DD
	Pathway    string `json:"pathway"`
	AssessType string `json:"assessmentType"`
	Country    string `json:"country"`
	Province   string `json:"province"`
	AgeGroup   string `json:"ageGroup"`
	Gender     string `json:"gender"`
	Substance  string `json:"substance"`
	RiskLevel  string `json:"riskLevel"`
	Completed  bool   `json:"completed"`
	Minutes    int    `json:"minutes"`
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
)

var records []AssessmentRecord

// weightedRisk gives each substance a different risk profile so charts
// have some realistic texture instead of flat uniform noise.
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

func generateRecords() {
	r := rand.New(rand.NewSource(42))
	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	n := 1400
	records = make([]AssessmentRecord, 0, n)

	for i := 1; i <= n; i++ {
		dayOffset := r.Intn(365)
		date := start.AddDate(0, 0, dayOffset)

		country := countryPool[r.Intn(len(countryPool))]
		province := "N/A"
		if country == "South Africa" {
			province = provinces[r.Intn(len(provinces))]
		}

		substance := substances[r.Intn(len(substances))]
		risk := weightedPick(riskLevels, substanceRiskWeight[substance], r)

		records = append(records, AssessmentRecord{
			ID:         i,
			Date:       date.Format("2006-01-02"),
			Pathway:    pathways[r.Intn(len(pathways))],
			AssessType: assessTypes[r.Intn(len(assessTypes))],
			Country:    country,
			Province:   province,
			AgeGroup:   ageGroups[r.Intn(len(ageGroups))],
			Gender:     genders[r.Intn(len(genders))],
			Substance:  substance,
			RiskLevel:  risk,
			Completed:  r.Float64() < 0.86,
			Minutes:    4 + r.Intn(18),
		})
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// series is a small helper shape the frontend chart components expect.
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
		"totalScreenings": total,
		"countriesActive": len(countrySet),
		"highRiskScreens": highRisk,
		"topSubstance":    topSubstance,
		"completionRate":  round1(float64(completed) / float64(total) * 100),
	})
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}

// --- /api/geography ---
func geographyHandler(w http.ResponseWriter, r *http.Request) {
	provLabels, provValues := countBy(func(a AssessmentRecord) string {
		if a.Province == "N/A" {
			return ""
		}
		return a.Province
	})
	// drop the empty "N/A" bucket from the province chart
	cl, cv := []string{}, []float64{}
	for i, l := range provLabels {
		if l != "" {
			cl = append(cl, l)
			cv = append(cv, provValues[i])
		}
	}

	countryLabels, countryValues := countBy(func(a AssessmentRecord) string { return a.Country })

	writeJSON(w, map[string]interface{}{
		"provinces": series{Labels: cl, Values: cv},
		"countries": series{Labels: countryLabels, Values: countryValues},
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

// --- /api/substances ---
func substancesHandler(w http.ResponseWriter, r *http.Request) {
	subLabels, subValues := countBy(func(a AssessmentRecord) string { return a.Substance })

	highPctLabels := []string{}
	highPctValues := []float64{}
	for _, s := range subLabels {
		total, high := 0, 0
		for _, rec := range records {
			if rec.Substance == s {
				total++
				if rec.RiskLevel == "High" {
					high++
				}
			}
		}
		highPctLabels = append(highPctLabels, s)
		highPctValues = append(highPctValues, round1(float64(high)/float64(total)*100))
	}

	writeJSON(w, map[string]interface{}{
		"counts":      series{Labels: subLabels, Values: subValues},
		"highRiskPct": series{Labels: highPctLabels, Values: highPctValues},
	})
}

// --- /api/risk ---
func riskHandler(w http.ResponseWriter, r *http.Request) {
	overallLabels, overallValues := countBy(func(a AssessmentRecord) string { return a.RiskLevel })

	subLabels, _ := countBy(func(a AssessmentRecord) string { return a.Substance })
	bySubstance := multiSeries{Labels: subLabels}
	for _, level := range riskLevels {
		vals := []float64{}
		for _, s := range subLabels {
			count := 0
			for _, rec := range records {
				if rec.Substance == s && rec.RiskLevel == level {
					count++
				}
			}
			vals = append(vals, float64(count))
		}
		bySubstance.Series = append(bySubstance.Series, namedVals{Name: level, Values: vals})
	}

	writeJSON(w, map[string]interface{}{
		"overall":     series{Labels: overallLabels, Values: overallValues},
		"bySubstance": bySubstance,
	})
}

// --- /api/trends ---
func trendsHandler(w http.ResponseWriter, r *http.Request) {
	totalByMonth := make([]float64, 12)
	completedByMonth := make([]float64, 12)

	for _, rec := range records {
		t, err := time.Parse("2006-01-02", rec.Date)
		if err != nil {
			continue
		}
		m := int(t.Month()) - 1
		totalByMonth[m]++
		if rec.Completed {
			completedByMonth[m]++
		}
	}

	writeJSON(w, map[string]interface{}{
		"months": multiSeries{
			Labels: monthNames,
			Series: []namedVals{
				{Name: "Total Screenings", Values: totalByMonth},
				{Name: "Completed", Values: completedByMonth},
			},
		},
	})
}

// --- /api/comparative ---
func comparativeHandler(w http.ResponseWriter, r *http.Request) {
	comparative := multiSeries{Labels: pathways}
	for _, level := range riskLevels {
		vals := []float64{}
		for _, p := range pathways {
			count := 0
			for _, rec := range records {
				if rec.Pathway == p && rec.RiskLevel == level {
					count++
				}
			}
			vals = append(vals, float64(count))
		}
		comparative.Series = append(comparative.Series, namedVals{Name: level, Values: vals})
	}

	writeJSON(w, map[string]interface{}{
		"byPathway": comparative,
	})
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
	http.HandleFunc("/api/substances", substancesHandler)
	http.HandleFunc("/api/risk", riskHandler)
	http.HandleFunc("/api/trends", trendsHandler)
	http.HandleFunc("/api/comparative", comparativeHandler)
	http.HandleFunc("/api/reports", reportsHandler)
	http.HandleFunc("/api/explorer", explorerHandler)
}
