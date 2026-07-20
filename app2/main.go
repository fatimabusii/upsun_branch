package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// Row is one record served to the data grid.
type Row struct {
	ID       int    `json:"id"`
	Product  string `json:"product"`
	Category string `json:"category"`
	Units    int    `json:"units"`
	Revenue  int    `json:"revenue"`
}

var sampleData = []Row{
	{1, "Wireless Mouse", "Accessories", 1240, 24800},
	{2, "Mechanical Keyboard", "Accessories", 860, 68800},
	{3, "27\" Monitor", "Displays", 430, 129000},
	{4, "USB-C Hub", "Accessories", 2100, 31500},
	{5, "Webcam 1080p", "Peripherals", 975, 39000},
	{6, "Laptop Stand", "Accessories", 1560, 23400},
	{7, "Noise-Cancelling Headset", "Audio", 640, 96000},
	{8, "Desk Lamp", "Office", 890, 17800},
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
	log.Println("Dashboard (app2) listening on", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
