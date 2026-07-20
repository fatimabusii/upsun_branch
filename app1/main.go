package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// Row is one record served to the data grid.
type Row struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	Department string `json:"department"`
	Salary     int    `json:"salary"`
}

var sampleData = []Row{
	{1, "Alice Novak", "Engineering Manager", "Engineering", 142000},
	{2, "Ben Torres", "Backend Developer", "Engineering", 118000},
	{3, "Chloe Dupont", "Product Designer", "Design", 109000},
	{4, "David Osei", "Data Analyst", "Analytics", 98000},
	{5, "Elena Petrova", "DevOps Engineer", "Engineering", 121000},
	{6, "Farah Hassan", "Marketing Lead", "Marketing", 104000},
	{7, "Grace Kim", "QA Engineer", "Engineering", 92000},
	{8, "Hiro Tanaka", "Sales Director", "Sales", 138000},
}

func dataHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(sampleData); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8888"
	}

	http.HandleFunc("/api/data", dataHandler)

	fs := http.FileServer(http.Dir("./web"))
	http.Handle("/", fs)

	addr := "0.0.0.0:" + port
	log.Println("Dashboard listening on", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
