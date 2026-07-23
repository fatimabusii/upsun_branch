package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	_ "github.com/go-sql-driver/mysql"
)

// ---------------------------------------------------------------------
// Real-data loader — replaces generateRecords() when DB_DSN is set.
//
// Query verified against the real schema shapes confirmed via DESCRIBE:
//   - assessment_detail has denormalized province/country columns directly
//     (no more town/attribute_value unpivot needed)
//   - assessment_date is a real timestamp (no STR_TO_DATE needed)
//   - completed indicator uses 'Yes'/'No' string values
//   - assessment_type_name gives clean Adult/Adolescent/Child cohorts
//
// GRANULARITY NOTE: this query returns one row per (assessment, substance).
// One assessment screened for 3 substances = 3 Records. Downstream code
// that computes "total screenings" should use countDistinctAssessments().
//
// If DB_DSN is unset, the app falls back to synthetic data — this keeps
// local dev without a live DB working.
// ---------------------------------------------------------------------

const realDataQuery = `
SELECT
    is_.assessment_id,
    ad.pathway_name,
    ad.assessment_type_name,
    ad.assessment_date,
    ad.assessment_completed_indicator,
    ad.assessee_age_group_range,
    ad.assessee_gender,
    ad.assessee_primary_residence_province,
    ad.assessee_primary_residence_country,
    ad.assist_user_id,
    s.name,
    is_.risk_level,
    COALESCE(TIMESTAMPDIFF(MINUTE, ad.assessment_date, ad.assessment_end_date), 0) AS minutes
FROM involvement_summary is_
JOIN assessment_detail ad ON ad.assessment_id = is_.assessment_id
JOIN substance s          ON s.substance_id  = is_.substance_id
WHERE ad.pathway_name NOT LIKE 'Research%'
  AND is_.risk_level IS NOT NULL
ORDER BY is_.assessment_id, s.name`

// substanceLabel maps the verbose real substance names to shorter chart
// labels — real names come from the substance.name column and would be
// unreadable in a bar chart otherwise.
func substanceLabel(realName string) string {
	switch realName {
	case "Alcoholic beverages":
		return "Alcohol"
	case "Tobacco products":
		return "Tobacco"
	case "Amphetamine type stimulants":
		return "Amphetamines"
	case "Sedatives or Sleeping Pills":
		return "Sedatives"
	case "Other: Please specify the substance in the text box below":
		return "Other"
	}
	return realName
}

// cohortForAssessmentType maps the assessment_type_name column (Adult /
// Adolescent / Child) to the plural cohort labels the docx uses (Adults
// / Adolescents / Children). Cleaner than the synthetic age-based
// mapping in cohortFor().
func cohortForAssessmentType(atName string) string {
	switch atName {
	case "Child":
		return "Children"
	case "Adolescent":
		return "Adolescents"
	case "Adult":
		return "Adults"
	}
	return "Unknown"
}

func versionForAssessmentType(atName string) string {
	if atName == "" {
		return "Unknown"
	}
	return atName
}

func loadRecordsFromDB(dsn string) ([]Record, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		return nil, err
	}

	rows, err := db.Query(realDataQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Record, 0, 25000)
	for rows.Next() {
		var (
			assessmentID   int64
			pathway        sql.NullString
			atName         sql.NullString
			assessmentDate sql.NullTime
			completedInd   sql.NullString
			ageRange       sql.NullString
			gender         sql.NullString
			province       sql.NullString
			country        sql.NullString
			practitionerID sql.NullInt64
			substanceName  sql.NullString
			riskLevel      sql.NullString
			minutes        sql.NullInt64
		)
		if err := rows.Scan(
			&assessmentID, &pathway, &atName, &assessmentDate, &completedInd,
			&ageRange, &gender, &province, &country, &practitionerID,
			&substanceName, &riskLevel, &minutes,
		); err != nil {
			log.Printf("db: skipping row, scan error: %v", err)
			continue
		}

		if !riskLevel.Valid || !substanceName.Valid {
			continue
		}

		// Country / Region: 99.9% of real rows have NULL country, and
		// the handful of non-NULL outliers (single-row typos like Andorra,
		// Afghanistan, etc.) are noise, not real multi-country operation.
		// Coalesce everything to South Africa per the agreed data decision —
		// this keeps "Countries Active" honest (1) instead of showing a
		// misleading count of typo-derived outliers.
		countryVal := "South Africa"

		pathwayVal := pathway.String
		screeningMode := "Practitioner-Assisted"
		if pathwayVal == "Any member of the public" {
			pathwayVal = "Self-Screen"
			screeningMode = "Self-Screen"
		}

		dateStr := ""
		if assessmentDate.Valid {
			dateStr = assessmentDate.Time.Format("2006-01-02")
		}

		rec := Record{
			ID:               int(assessmentID),
			Date:             dateStr,
			Region:           "Africa",
			Country:          countryVal,
			Province:         province.String,
			AgeGroup:         nullOr(ageRange, "Unknown"),
			Cohort:           cohortForAssessmentType(atName.String),
			ScreeningVersion: versionForAssessmentType(atName.String),
			Gender:           nullOr(gender, "Not specified"),
			ScreeningMode:    screeningMode,
			Pathway:          pathwayVal,
			Substance:        substanceLabel(substanceName.String),
			RiskLevel:        riskLevel.String,
			Intervention:     interventionFor(riskLevel.String),
			Completed:        completedInd.Valid && completedInd.String == "Yes",
			Minutes:          int(minutes.Int64),
		}
		if practitionerID.Valid {
			rec.PractitionerID = "P-" + strconv.FormatInt(practitionerID.Int64, 10)
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func nullOr(s sql.NullString, fallback string) string {
	if s.Valid && s.String != "" {
		return s.String
	}
	return fallback
}

// countDistinctAssessments counts unique assessment IDs across a record
// slice. Real records share IDs across substances (one assessment → many
// substance rows); synthetic records don't. This gives the correct
// "screening count" for both paths.
func countDistinctAssessments(recs []Record) int {
	seen := map[int]bool{}
	for _, r := range recs {
		seen[r.ID] = true
	}
	return len(seen)
}

// upsunRelationship mirrors the fields Upsun/Platform.sh includes for a
// database relationship inside PLATFORM_RELATIONSHIPS. Only the fields
// needed to build a DSN are declared; extra JSON fields are ignored.
type upsunRelationship struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Path     string `json:"path"` // database name
}

// resolveDSN decides how to connect to the database:
//  1. If DB_DSN is set (local dev), use it as-is.
//  2. Otherwise, if PLATFORM_RELATIONSHIPS is set (running on Upsun),
//     decode it and build a DSN from the "db" relationship — this must
//     match the relationship name declared in .upsun/config.yaml
//     (relationships: { db: 'db:mysql' }).
//  3. If neither is set, returns "" — caller falls back to synthetic data.
func resolveDSN() string {
	if dsn := os.Getenv("DB_DSN"); dsn != "" {
		return dsn
	}

	encoded := os.Getenv("PLATFORM_RELATIONSHIPS")
	if encoded == "" {
		return ""
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		log.Printf("db: failed to base64-decode PLATFORM_RELATIONSHIPS: %v", err)
		return ""
	}

	var relationships map[string][]upsunRelationship
	if err := json.Unmarshal(decoded, &relationships); err != nil {
		log.Printf("db: failed to parse PLATFORM_RELATIONSHIPS JSON: %v", err)
		return ""
	}

	dbConns, ok := relationships["db"]
	if !ok || len(dbConns) == 0 {
		log.Println("db: no 'db' relationship found in PLATFORM_RELATIONSHIPS — check .upsun/config.yaml relationships block matches")
		return ""
	}

	c := dbConns[0]
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true", c.Username, c.Password, c.Host, c.Port, c.Path)
}

// maybeLoadRealData: called from main() before route registration.
// Resolves a DSN (local DB_DSN, or Upsun's PLATFORM_RELATIONSHIPS) and
// loads real data if one is found, else keeps the synthetic slice.
func maybeLoadRealData() {
	dsn := resolveDSN()
	if dsn == "" {
		log.Println("no DB_DSN or PLATFORM_RELATIONSHIPS found — using synthetic data")
		return
	}
	real, err := loadRecordsFromDB(dsn)
	if err != nil {
		log.Printf("db: failed to load real data (%v) — falling back to synthetic", err)
		return
	}
	if len(real) == 0 {
		log.Println("db: real data query returned 0 rows — keeping synthetic")
		return
	}
	records = real
	log.Printf("db: loaded %d real rows from database", len(records))
}
