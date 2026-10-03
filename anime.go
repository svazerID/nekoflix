package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/tidwall/gjson"
)

type ExtractionResult struct {
	Success    bool         `json:"success"`
	StatusCode int          `json:"status_code,omitempty"`
	Data       any          `json:"data,omitempty"`
	Error      *ErrorDetail `json:"error,omitempty"`
	Timestamp  int64        `json:"timestamp"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ScraperEngine struct {
	client *http.Client
}

type EpisodeData struct {
	SeriesID      string             `json:"series_id,omitempty"`
	SeriesTitle   string             `json:"series_title,omitempty"`
	SeriesURL     string             `json:"series_url,omitempty"`
	EpisodeNumber string             `json:"episode_number,omitempty"`
	EpisodeTitle  string             `json:"episode_title,omitempty"`
	EpisodeURL    string             `json:"episode_url,omitempty"`
	Thumbnail     string             `json:"thumbnail,omitempty"`
	PrevURL       string             `json:"prev_url,omitempty"`
	NextURL       string             `json:"next_url,omitempty"`
	Streams       []StreamServerItem `json:"streams,omitempty"`
	Downloads     []DownloadItem     `json:"downloads,omitempty"`
}

type StreamServerItem struct {
	ServerName   string `json:"server_name"`
	PostID       string `json:"post_id,omitempty"`
	Nume         string `json:"nume,omitempty"`
	EmbedURL     string `json:"embed_url,omitempty"`
	DirectStream string `json:"direct_stream,omitempty"`
}

type DownloadItem struct {
	ServerName string `json:"server_name"`
	OutURL     string `json:"out_url"`
	DirectURL  string `json:"direct_url,omitempty"`
	Quality    string `json:"quality,omitempty"`
}

type SeriesData struct {
	Title         string        `json:"title"`
	JapaneseTitle string        `json:"japanese_title,omitempty"`
	Thumbnail     string        `json:"thumbnail,omitempty"`
	Score         string        `json:"score,omitempty"`
	Status        string        `json:"status,omitempty"`
	Type          string        `json:"type,omitempty"`
	TotalEpisodes string        `json:"total_episodes,omitempty"`
	Duration      string        `json:"duration,omitempty"`
	ReleaseDate   string        `json:"release_date,omitempty"`
	Studio        string        `json:"studio,omitempty"`
	Genres        []string      `json:"genres,omitempty"`
	Synopsis      string        `json:"synopsis,omitempty"`
	Episodes      []EpisodeItem `json:"episodes,omitempty"`
}

type EpisodeItem struct {
	Number string `json:"number"`
	Title  string `json:"title"`
	URL    string `json:"url"`
}

type ReleaseItem struct {
	Title         string `json:"title"`
	URL           string `json:"url"`
	EpisodeNumber string `json:"episode_number,omitempty"`
	Thumbnail     string `json:"thumbnail,omitempty"`
}

func NewScraperEngine(timeout time.Duration) (*ScraperEngine, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("cookiejar_init_failed: %w", err)
	}

	transport := &http.Transport{
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression: false,
		ForceAttemptHTTP2:   true,
	}

	client := &http.Client{
		Jar:       jar,
		Transport: transport,
		Timeout:   timeout,
	}

	return &ScraperEngine{client: client}, nil
}

func (s *ScraperEngine) applyHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Sec-Ch-Ua", `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	req.Header.Set("Sec-Fetch-User", "?1")
	req.Header.Set("Upgrade-Insecure-Requests", "1")

	if referer != "" {
		req.Header.Set("Referer", referer)
	}
}

func (s *ScraperEngine) fetchHTML(ctx context.Context, targetURL string, referer string) (string, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return "", 0, err
	}

	s.applyHeaders(req, referer)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, err
	}

	return string(bodyBytes), resp.StatusCode, nil
}

func (s *ScraperEngine) parseBase64Scripts(htmlContent string) map[string]string {
	results := make(map[string]string)
	re := regexp.MustCompile(`data:text/javascript;base64,([A-Za-z0-9+/=]+)`)
	matches := re.FindAllStringSubmatch(htmlContent, -1)
	for _, match := range matches {
		if len(match) > 1 {
			decodedBytes, err := base64.StdEncoding.DecodeString(match[1])
			if err == nil {
				text := string(decodedBytes)
				if strings.Contains(text, "kotakajax") {
					results["kotakajax"] = text
				}
				if strings.Contains(text, "episodeToTrack") {
					results["episodeToTrack"] = text
				}
			}
		}
	}
	return results
}

func (s *ScraperEngine) resolvePlayerAjax(ctx context.Context, apiURL string, postID string, nume string, serverName string, nonce string, pageURL string) string {
	form := url.Values{}
	form.Set("action", "player_ajax")
	form.Set("post", postID)
	form.Set("nume", nume)
	form.Set("serverName", serverName)
	form.Set("nonce", nonce)
	form.Set("did", fmt.Sprintf("k_%x%d", time.Now().UnixNano(), os.Getpid()))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(form.Encode()))
	if err != nil {
		return ""
	}

	s.applyHeaders(req, pageURL)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://s13.nontonanimeid.boats")

	resp, err := s.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	reIframe := regexp.MustCompile(`src=["']([^"']+)["']`)
	matches := reIframe.FindStringSubmatch(string(bodyBytes))
	if len(matches) > 1 {
		return matches[1]
	}

	return ""
}

func (s *ScraperEngine) decryptEmbedM3U8(ctx context.Context, embedURL string, referer string) string {
	htmlContent, statusCode, err := s.fetchHTML(ctx, embedURL, referer)
	if err != nil || statusCode >= 400 {
		return ""
	}

	prefix := "_w['at'+'ob']("
	start := strings.Index(htmlContent, prefix)
	if start == -1 {
		prefix = `_w["at"+"ob"](`
		start = strings.Index(htmlContent, prefix)
	}
	if start == -1 {
		return ""
	}

	payloadStart := start + len(prefix)
	endMarker := ");var "
	markerIdx := strings.Index(htmlContent[payloadStart:], endMarker)
	if markerIdx == -1 {
		return ""
	}
	rawArg := strings.TrimSpace(htmlContent[payloadStart : payloadStart+markerIdx])
	if strings.HasPrefix(rawArg, "'") && strings.HasSuffix(rawArg, "'") {
		rawArg = rawArg[1 : len(rawArg)-1]
	} else if strings.HasPrefix(rawArg, `"`) && strings.HasSuffix(rawArg, `"`) {
		rawArg = rawArg[1 : len(rawArg)-1]
	}

	reConcat := regexp.MustCompile(`['"]\s*\+\s*['"]`)
	cleanB64 := reConcat.ReplaceAllString(rawArg, "")

	reArray := regexp.MustCompile(`var s=['"]([0-9,]+)['"]`)
	arrayMatch := reArray.FindStringSubmatch(htmlContent)
	if len(arrayMatch) < 2 {
		return ""
	}

	reCalc := regexp.MustCompile(`parseInt\(s\[j\],10\)\s*-\s*(\d+)\s*\*\s*\(j\s*\+\s*(\d+)\)`)
	calcMatch := reCalc.FindStringSubmatch(htmlContent)
	if len(calcMatch) < 3 {
		return ""
	}

	multiplier, _ := strconv.Atoi(calcMatch[1])
	offset, _ := strconv.Atoi(calcMatch[2])

	sTokens := strings.Split(arrayMatch[1], ",")
	key := make([]byte, len(sTokens))
	for j, token := range sTokens {
		val, _ := strconv.Atoi(token)
		computed := (val - multiplier*(j+offset)) & 255
		key[j] = byte(computed)
	}

	cipherBytes, err := base64.StdEncoding.DecodeString(cleanB64)
	if err != nil || len(key) == 0 {
		return ""
	}

	decrypted := make([]byte, len(cipherBytes))
	for i, b := range cipherBytes {
		decrypted[i] = b ^ key[i%len(key)]
	}

	decryptedCode := string(decrypted)

	reFile := regexp.MustCompile(`"file"\s*:\s*"(https://[^"]+)"`)
	fileMatches := reFile.FindAllStringSubmatch(decryptedCode, -1)
	for _, m := range fileMatches {
		if len(m) > 1 && !strings.Contains(m[1], "blank.mp4") {
			return strings.ReplaceAll(m[1], `\/`, `/`)
		}
	}

	reM3U8 := regexp.MustCompile(`https://[^"'\s\\]+\.m3u8`)
	matchM3U8 := reM3U8.FindString(decryptedCode)
	if matchM3U8 != "" && !strings.Contains(matchM3U8, "blank.mp4") {
		return strings.ReplaceAll(matchM3U8, `\/`, `/`)
	}

	return ""
}

func (s *ScraperEngine) resolveDownloadMirror(ctx context.Context, outURL string, referer string) (string, string) {
	htmlContent, statusCode, err := s.fetchHTML(ctx, outURL, referer)
	if err != nil || statusCode >= 400 {
		return "", ""
	}

	reDL := regexp.MustCompile(`window\.DL\s*=\s*\{([^}]+)\};`)
	dlMatch := reDL.FindStringSubmatch(htmlContent)
	if len(dlMatch) < 2 {
		return "", ""
	}

	dlBlock := "{" + dlMatch[1] + "}"
	isBlogger := strings.Contains(dlBlock, "isBlogger: true")

	reEncrypted := regexp.MustCompile(`encrypted:\s*["']([^"']+)["']`)
	reTitle := regexp.MustCompile(`title:\s*["']([^"']+)["']`)
	reGate := regexp.MustCompile(`gate:\s*([0-9]+)`)
	reSig := regexp.MustCompile(`sig:\s*["']([^"']+)["']`)

	encMatch := reEncrypted.FindStringSubmatch(dlBlock)
	titleMatch := reTitle.FindStringSubmatch(dlBlock)
	gateMatch := reGate.FindStringSubmatch(dlBlock)
	sigMatch := reSig.FindStringSubmatch(dlBlock)

	if len(encMatch) < 2 {
		return "", ""
	}

	encryptedVal := encMatch[1]
	titleVal := ""
	if len(titleMatch) > 1 {
		titleVal = titleMatch[1]
	}
	gateVal := ""
	if len(gateMatch) > 1 {
		gateVal = gateMatch[1]
	}
	sigVal := ""
	if len(sigMatch) > 1 {
		sigVal = sigMatch[1]
	}

	parsedOutURL, err := url.Parse(outURL)
	if err != nil {
		return "", ""
	}
	hostOrigin := fmt.Sprintf("%s://%s", parsedOutURL.Scheme, parsedOutURL.Host)

	var targetRequestURL string
	var tokenPayloadMap map[string]string

	if isBlogger {
		dlReqURL := fmt.Sprintf("%s/video/get-download.php?mode=lokal&vid=%s&title=%s&dl=yes&json=true", hostOrigin, url.QueryEscape(encryptedVal), url.QueryEscape(titleVal))
		targetRequestURL = dlReqURL
		tokenPayloadMap = map[string]string{"url": dlReqURL}
	} else {
		targetRequestURL = encryptedVal
		tokenPayloadMap = map[string]string{"url": encryptedVal}
	}

	tokenEndpoint := fmt.Sprintf("%s/video/get-token.php", hostOrigin)
	payloadJSON, _ := json.Marshal(tokenPayloadMap)
	tokenReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, bytes.NewReader(payloadJSON))
	if err != nil {
		return "", ""
	}

	s.applyHeaders(tokenReq, outURL)
	tokenReq.Header.Set("Content-Type", "application/json")
	tokenReq.Header.Set("X-Fingerprint", "dummy-fingerprint")
	tokenReq.Header.Set("X-DL-Gate", gateVal)
	tokenReq.Header.Set("X-DL-Sig", sigVal)

	tokenResp, err := s.client.Do(tokenReq)
	if err != nil {
		return "", ""
	}
	defer tokenResp.Body.Close()

	tokenBody, _ := io.ReadAll(tokenResp.Body)
	tokenData := string(tokenBody)

	token := gjson.Get(tokenData, "token").String()
	timestamp := gjson.Get(tokenData, "timestamp").String()
	challenge := gjson.Get(tokenData, "challenge").String()

	if token == "" {
		return "", ""
	}

	dlEndpoint := fmt.Sprintf("%s/video/get-download.php", hostOrigin)
	if isBlogger {
		dlEndpoint = targetRequestURL
	}

	dlPayloadMap := map[string]string{
		"url":       targetRequestURL,
		"challenge": challenge,
	}
	dlPayloadJSON, _ := json.Marshal(dlPayloadMap)
	dlReq, err := http.NewRequestWithContext(ctx, http.MethodPost, dlEndpoint, bytes.NewReader(dlPayloadJSON))
	if err != nil {
		return "", ""
	}

	s.applyHeaders(dlReq, outURL)
	dlReq.Header.Set("Content-Type", "application/json")
	dlReq.Header.Set("X-Security-Token", token)
	dlReq.Header.Set("X-Timestamp", timestamp)
	dlReq.Header.Set("X-Fingerprint", "dummy-fingerprint")
	dlReq.Header.Set("X-Challenge", challenge)

	dlResp, err := s.client.Do(dlReq)
	if err != nil {
		return "", ""
	}
	defer dlResp.Body.Close()

	dlBody, _ := io.ReadAll(dlResp.Body)
	dlData := string(dlBody)

	resolvedPath := ""
	quality := ""

	if isBlogger {
		for _, q := range []string{"1080p", "HD", "720p", "480p", "360p"} {
			linkArr := gjson.Get(dlData, fmt.Sprintf("links.%s", q)).Array()
			if len(linkArr) > 0 {
				resolvedPath = linkArr[0].Get("url").String()
				quality = q
				break
			}
		}
	} else {
		downloadLinks := gjson.Get(dlData, "links.download").Array()
		if len(downloadLinks) > 0 {
			resolvedPath = downloadLinks[0].Get("url").String()
		}
	}

	if resolvedPath == "" {
		return "", ""
	}

	finalTargetURL := resolvedPath
	if strings.HasPrefix(resolvedPath, "/") {
		finalTargetURL = hostOrigin + resolvedPath
	}

	redirReq, err := http.NewRequestWithContext(ctx, http.MethodGet, finalTargetURL, nil)
	if err != nil {
		return finalTargetURL, quality
	}

	s.applyHeaders(redirReq, outURL)
	noFollowClient := &http.Client{
		Jar: s.client.Jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
		Timeout: 10 * time.Second,
	}

	redirResp, err := noFollowClient.Do(redirReq)
	if err == nil {
		defer redirResp.Body.Close()
		loc := redirResp.Header.Get("Location")
		if loc != "" {
			return loc, quality
		}
	}

	return finalTargetURL, quality
}

func (s *ScraperEngine) extractEpisodePage(ctx context.Context, pageURL string, htmlContent string, startTime int64, statusCode int) ExtractionResult {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return ExtractionResult{
			Success:   false,
			Error:     &ErrorDetail{Code: "HTML_PARSE_FAILED", Message: err.Error()},
			Timestamp: startTime,
		}
	}

	jsMap := s.parseBase64Scripts(htmlContent)
	trackRaw := jsMap["episodeToTrack"]
	ajaxRaw := jsMap["kotakajax"]

	data := EpisodeData{
		EpisodeURL: pageURL,
	}

	if trackRaw != "" {
		eqIdx := strings.Index(trackRaw, "var episodeToTrack=")
		if eqIdx != -1 {
			jsonSegment := strings.TrimSpace(trackRaw[eqIdx+len("var episodeToTrack="):])
			jsonSegment = strings.TrimSuffix(jsonSegment, ";")
			data.SeriesID = gjson.Get(jsonSegment, "seriesId").String()
			data.SeriesTitle = gjson.Get(jsonSegment, "seriesTitle").String()
			data.SeriesURL = gjson.Get(jsonSegment, "seriesUrl").String()
			data.EpisodeNumber = gjson.Get(jsonSegment, "episodeNumber").String()
			data.Thumbnail = gjson.Get(jsonSegment, "poster").String()
		}
	}

	if data.EpisodeTitle == "" {
		data.EpisodeTitle = strings.TrimSpace(doc.Find("h1.entry-title, .name, title").First().Text())
	}
	if data.Thumbnail == "" {
		data.Thumbnail = doc.Find(".featuredimgs img, meta[property='og:image']").AttrOr("src", "")
	}

	data.PrevURL = doc.Find(".naveps .nvs a[title*='Prev'], .naveps .nvs a:contains('Prev')").AttrOr("href", "")
	data.NextURL = doc.Find(".naveps .nvs a[title*='Next'], .naveps .nvs a:contains('Next')").AttrOr("href", "")

	adminAjaxURL := "https://s13.nontonanimeid.boats/wp-admin/admin-ajax.php"
	nonceVal := ""
	if ajaxRaw != "" {
		eqIdx := strings.Index(ajaxRaw, "var kotakajax=")
		if eqIdx != -1 {
			jsonSegment := strings.TrimSpace(ajaxRaw[eqIdx+len("var kotakajax="):])
			jsonSegment = strings.TrimSuffix(jsonSegment, ";")
			ajaxURLParsed := gjson.Get(jsonSegment, "url").String()
			if ajaxURLParsed != "" {
				adminAjaxURL = ajaxURLParsed
			}
			nonceVal = gjson.Get(jsonSegment, "nonce").String()
		}
	}

	doc.Find(".kotak_player_option").Each(func(i int, sel *goquery.Selection) {
		postID, _ := sel.Attr("data-post")
		serverName, _ := sel.Attr("data-type")
		nume, _ := sel.Attr("data-nume")
		label := strings.TrimSpace(sel.Text())
		if label == "" {
			label = serverName
		}

		embedURL := ""
		directM3U8 := ""

		if nonceVal != "" && postID != "" && nume != "" {
			embedURL = s.resolvePlayerAjax(ctx, adminAjaxURL, postID, nume, serverName, nonceVal, pageURL)
			if strings.Contains(embedURL, "kotakanimeid.link") {
				directM3U8 = s.decryptEmbedM3U8(ctx, embedURL, pageURL)
			}
		}

		data.Streams = append(data.Streams, StreamServerItem{
			ServerName:   label,
			PostID:       postID,
			Nume:         nume,
			EmbedURL:     embedURL,
			DirectStream: directM3U8,
		})
	})

	doc.Find("#download_area .listlink a, #arealinker .listlink a").Each(func(i int, sel *goquery.Selection) {
		outHref, exists := sel.Attr("href")
		if !exists || !strings.Contains(outHref, "/out/") {
			return
		}

		serverLabel := strings.TrimSpace(sel.Text())
		directURL, qual := s.resolveDownloadMirror(ctx, outHref, pageURL)

		data.Downloads = append(data.Downloads, DownloadItem{
			ServerName: serverLabel,
			OutURL:     outHref,
			DirectURL:  directURL,
			Quality:    qual,
		})
	})

	return ExtractionResult{
		Success:    true,
		StatusCode: statusCode,
		Data:       data,
		Timestamp:  startTime,
	}
}

func (s *ScraperEngine) extractSeriesPage(pageURL string, htmlContent string, startTime int64, statusCode int) ExtractionResult {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return ExtractionResult{
			Success:   false,
			Error:     &ErrorDetail{Code: "HTML_PARSE_FAILED", Message: err.Error()},
			Timestamp: startTime,
		}
	}

	data := SeriesData{
		Title: strings.TrimSpace(doc.Find(".entry-title, .title.less").First().Text()),
	}

	doc.Find("meta[property='og:image']").Each(func(i int, s *goquery.Selection) {
		if data.Thumbnail == "" {
			data.Thumbnail = s.AttrOr("content", "")
		}
	})

	doc.Find(".content-info, .infokotak, .info-content, .tableinfo tr").Each(func(i int, sel *goquery.Selection) {
		text := strings.TrimSpace(sel.Text())
		if strings.Contains(text, "Japanese") || strings.Contains(text, "Judul") {
			data.JapaneseTitle = strings.TrimSpace(strings.ReplaceAll(text, "Japanese", ""))
		}
		if strings.Contains(text, "Skor") || strings.Contains(text, "Score") {
			data.Score = strings.TrimSpace(strings.ReplaceAll(text, "Score", ""))
		}
		if strings.Contains(text, "Status") {
			data.Status = strings.TrimSpace(strings.ReplaceAll(text, "Status", ""))
		}
		if strings.Contains(text, "Tipe") || strings.Contains(text, "Type") {
			data.Type = strings.TrimSpace(strings.ReplaceAll(text, "Type", ""))
		}
		if strings.Contains(text, "Total Episode") || strings.Contains(text, "Episodes") {
			data.TotalEpisodes = strings.TrimSpace(strings.ReplaceAll(text, "Episodes", ""))
		}
		if strings.Contains(text, "Durasi") || strings.Contains(text, "Duration") {
			data.Duration = strings.TrimSpace(strings.ReplaceAll(text, "Duration", ""))
		}
		if strings.Contains(text, "Studio") {
			data.Studio = strings.TrimSpace(strings.ReplaceAll(text, "Studio", ""))
		}
	})

	doc.Find(".tagline, .genre-info a, a[href*='/genres/']").Each(func(i int, sel *goquery.Selection) {
		genre := strings.TrimSpace(sel.Text())
		if genre != "" && !strings.Contains(genre, "Lihat") {
			data.Genres = append(data.Genres, genre)
		}
	})

	data.Synopsis = strings.TrimSpace(doc.Find(".entry-content.seriesdesc, .entry-content p, .desc p").Text())

	doc.Find(".episodelist ul li, .series-chapterlist li, a[href*='-episode-']").Each(func(i int, sel *goquery.Selection) {
		anchor := sel
		if !sel.Is("a") {
			anchor = sel.Find("a")
		}
		link, exists := anchor.Attr("href")
		if exists && strings.Contains(link, "-episode-") {
			title := strings.TrimSpace(anchor.Text())
			epNum := ""
			reEp := regexp.MustCompile(`episode-(\d+)`)
			epMatches := reEp.FindStringSubmatch(link)
			if len(epMatches) > 1 {
				epNum = epMatches[1]
			}
			data.Episodes = append(data.Episodes, EpisodeItem{
				Number: epNum,
				Title:  title,
				URL:    link,
			})
		}
	})

	return ExtractionResult{
		Success:    true,
		StatusCode: statusCode,
		Data:       data,
		Timestamp:  startTime,
	}
}

func (s *ScraperEngine) extractCatalogPage(htmlContent string, startTime int64, statusCode int) ExtractionResult {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return ExtractionResult{
			Success:   false,
			Error:     &ErrorDetail{Code: "HTML_PARSE_FAILED", Message: err.Error()},
			Timestamp: startTime,
		}
	}

	var results []ReleaseItem
	doc.Find("article.animeseries, .as-anime-card, .result .archive .as-anime-card").Each(func(i int, sel *goquery.Selection) {
		linkSel := sel.Find("a").First()
		if sel.Is("a") {
			linkSel = sel
		}

		targetHref, _ := linkSel.Attr("href")
		title := sel.Find(".title, .as-card-title, h3").Text()
		title = strings.TrimSpace(title)

		thumb := sel.Find("img").AttrOr("src", "")
		ep := strings.TrimSpace(sel.Find(".types.episodes, .as-card-episode").Text())

		if targetHref != "" && title != "" {
			results = append(results, ReleaseItem{
				Title:         title,
				URL:           targetHref,
				EpisodeNumber: ep,
				Thumbnail:     thumb,
			})
		}
	})

	return ExtractionResult{
		Success:    true,
		StatusCode: statusCode,
		Data:       results,
		Timestamp:  startTime,
	}
}

func (s *ScraperEngine) ExtractData(ctx context.Context, targetURL string) ExtractionResult {
	startTime := time.Now().UnixMilli()

	htmlContent, statusCode, err := s.fetchHTML(ctx, targetURL, "")
	if err != nil {
		return ExtractionResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      &ErrorDetail{Code: "NETWORK_REQUEST_FAILED", Message: err.Error()},
			Timestamp:  startTime,
		}
	}

	if statusCode >= 400 {
		return ExtractionResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      &ErrorDetail{Code: "HTTP_UPSTREAM_ERROR", Message: fmt.Sprintf("status: %d", statusCode)},
			Timestamp:  startTime,
		}
	}

	if strings.Contains(targetURL, "-episode-") {
		return s.extractEpisodePage(ctx, targetURL, htmlContent, startTime, statusCode)
	}

	if strings.Contains(targetURL, "/anime/") {
		return s.extractSeriesPage(targetURL, htmlContent, startTime, statusCode)
	}

	return s.extractCatalogPage(htmlContent, startTime, statusCode)
}

func main() {
	target := "https://s13.nontonanimeid.boats"
	if len(os.Args) > 1 {
		target = os.Args[1]
	}

	engine, err := NewScraperEngine(25 * time.Second)
	if err != nil {
		fmt.Fprintf(os.Stderr, "engine_init_failed: %v\n", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	result := engine.ExtractData(ctx, target)

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))
}