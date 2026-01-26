package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

var (
	qbtURL     string
	httpClient *http.Client
	skipAuth   bool
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime)

	port := os.Getenv("PORT")
	if port == "" {
		port = "9999"
	}
	qbtURL = os.Getenv("QBT_URL")
	if qbtURL == "" {
		qbtURL = "http://localhost:8080"
	}

	if os.Getenv("ALLOW_SELF_SIGNED_CERTS") == "true" {
		httpClient = &http.Client{
			Timeout:   5 * time.Second,
			Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		}
	} else {
		httpClient = &http.Client{Timeout: 5 * time.Second}
	}

	skipAuth = detectSkipAuth()
	if skipAuth {
		log.Printf("qBittorrent auth bypass detected, SID validation disabled")
	}

	http.HandleFunc("/health", withLogging(handleHealth))
	http.HandleFunc("/ip", withLogging(withAuth(handleIP)))
	http.HandleFunc("/speedtest", withLogging(withAuth(handleSpeedtest)))
	http.HandleFunc("/speedtest/servers", withLogging(withAuth(handleSpeedtestServers)))
	http.HandleFunc("/dns", withLogging(withAuth(handleDNS)))
	http.HandleFunc("/interfaces", withLogging(withAuth(handleInterfaces)))
	http.HandleFunc("/exec", withLogging(withAuth(handleExec)))

	log.Printf("net-agent listening on :%s (qbt: %s)", port, qbtURL)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func detectSkipAuth() bool {
	req, err := http.NewRequest("GET", qbtURL+"/api/v2/app/version", nil)
	if err != nil {
		return false
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func withLogging(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: 200}
		next(wrapped, r)
		log.Printf("%s %s %d %v", r.Method, r.URL.Path, wrapped.status, time.Since(start).Round(time.Millisecond))
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if skipAuth {
			next(w, r)
			return
		}
		sid := r.Header.Get("X-QBT-SID")
		if sid == "" {
			if cookie, err := r.Cookie("SID"); err == nil {
				sid = cookie.Value
			}
		}
		if sid == "" {
			log.Printf("auth failed: missing SID for %s", r.URL.Path)
			http.Error(w, `{"error":"missing SID"}`, http.StatusUnauthorized)
			return
		}
		if !validateSID(sid) {
			log.Printf("auth failed: invalid SID for %s", r.URL.Path)
			http.Error(w, `{"error":"invalid SID"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func validateSID(sid string) bool {
	req, err := http.NewRequest("GET", qbtURL+"/api/v2/app/version", nil)
	if err != nil {
		return false
	}
	req.AddCookie(&http.Cookie{Name: "SID", Value: sid})
	resp, err := httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleIP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://ipinfo.io/json")
	if err != nil {
		log.Printf("ip lookup failed: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	io.Copy(w, resp.Body)
}

func handleSpeedtest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	serverID := r.URL.Query().Get("server")
	args := []string{"--accept-license", "--accept-gdpr", "--format=json"}
	if serverID != "" {
		args = append(args, "--server-id="+serverID)
		log.Printf("speedtest starting with server %s", serverID)
	} else {
		log.Printf("speedtest starting (auto server)")
	}
	out, err := exec.Command("speedtest", args...).Output()
	if err != nil {
		errMsg := err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok {
			errMsg = string(exitErr.Stderr)
		}
		log.Printf("speedtest failed: %s", errMsg)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, strings.ReplaceAll(errMsg, `"`, `\"`)), http.StatusInternalServerError)
		return
	}
	w.Write(out)
}

func handleSpeedtestServers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	out, err := exec.Command("speedtest", "--accept-license", "--accept-gdpr", "--format=json", "--servers").Output()
	if err != nil {
		errMsg := err.Error()
		if exitErr, ok := err.(*exec.ExitError); ok {
			errMsg = string(exitErr.Stderr)
		}
		log.Printf("speedtest servers failed: %s", errMsg)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, strings.ReplaceAll(errMsg, `"`, `\"`)), http.StatusInternalServerError)
		return
	}
	w.Write(out)
}

func handleDNS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	out, err := exec.Command("cat", "/etc/resolv.conf").Output()
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	lines := strings.Split(string(out), "\n")
	var servers []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "nameserver") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				servers = append(servers, parts[1])
			}
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"servers": servers, "raw": string(out)})
}

func handleInterfaces(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	out, err := exec.Command("ip", "-j", "addr").Output()
	if err != nil {
		outFallback, errFallback := exec.Command("ip", "addr").Output()
		if errFallback != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"raw": string(outFallback)})
		return
	}
	w.Write(out)
}

func handleExec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	cmd := r.URL.Query().Get("cmd")
	if cmd == "" {
		http.Error(w, `{"error":"missing cmd parameter"}`, http.StatusBadRequest)
		return
	}
	allowed := map[string]bool{"curl": true, "wget": true, "dig": true, "nslookup": true, "ping": true, "traceroute": true}
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		http.Error(w, `{"error":"empty command"}`, http.StatusBadRequest)
		return
	}
	if !allowed[parts[0]] {
		log.Printf("exec blocked: command not allowed: %s", parts[0])
		http.Error(w, fmt.Sprintf(`{"error":"command not allowed: %s"}`, parts[0]), http.StatusForbidden)
		return
	}
	log.Printf("exec: %s", cmd)
	execCmd := exec.CommandContext(r.Context(), parts[0], parts[1:]...)
	out, err := execCmd.CombinedOutput()
	if err != nil {
		log.Printf("exec error: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{"output": string(out), "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"output": string(out)})
}
