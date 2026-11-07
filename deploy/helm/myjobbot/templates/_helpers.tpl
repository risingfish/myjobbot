{{- define "myjobbot.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "myjobbot.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "myjobbot.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "myjobbot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Selector labels for one component; call with (dict "ctx" $ "component" "web"). */}}
{{- define "myjobbot.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myjobbot.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "myjobbot.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}

{{- define "myjobbot.secretName" -}}
{{- if .Values.secret.existingSecret }}
{{- .Values.secret.existingSecret }}
{{- else if .Values.secret.create }}
{{- include "myjobbot.fullname" . }}
{{- else }}
{{- fail "set secret.existingSecret, or secret.create with secret.values" }}
{{- end }}
{{- end }}

{{- define "myjobbot.claimName" -}}
{{- default (printf "%s-data" (include "myjobbot.fullname" .)) .Values.persistence.existingClaim }}
{{- end }}

{{/* The host:port names the web UI answers to; localhost:<port> is always there for the probes. */}}
{{- define "myjobbot.hosts" -}}
{{- $hosts := list (printf "localhost:%v" .Values.web.port) }}
{{- if .Values.web.hosts }}
{{- $hosts = concat $hosts .Values.web.hosts }}
{{- else if .Values.ingress.enabled }}
{{- $hosts = concat $hosts .Values.ingress.hosts }}
{{- end }}
{{- $hosts | uniq | join "," }}
{{- end }}

{{- define "myjobbot.baseUrl" -}}
{{- if .Values.web.baseUrl }}
{{- .Values.web.baseUrl }}
{{- else if and .Values.ingress.enabled .Values.ingress.hosts }}
{{- printf "http%s://%s" (ternary "s" "" (not (empty .Values.ingress.tls))) (first .Values.ingress.hosts) }}
{{- else }}
{{- printf "http://localhost:%v" .Values.web.port }}
{{- end }}
{{- end }}

{{- define "myjobbot.trustedProxies" -}}
{{- if ne (toString .Values.web.trustedProxies) "" }}
{{- .Values.web.trustedProxies }}
{{- else }}
{{- ternary 1 0 .Values.ingress.enabled }}
{{- end }}
{{- end }}

{{- define "myjobbot.browserUrl" -}}
{{- if .Values.browser.enabled }}
{{- printf "ws://%s-browser:3000/" (include "myjobbot.fullname" .) }}
{{- else }}
{{- .Values.externalBrowserUrl }}
{{- end }}
{{- end }}

{{- define "myjobbot.searxngUrl" -}}
{{- if .Values.searxng.enabled }}
{{- printf "http://%s-searxng:8080" (include "myjobbot.fullname" .) }}
{{- else }}
{{- .Values.externalSearxngUrl }}
{{- end }}
{{- end }}

{{/* Environment shared by the web UI and the agent. */}}
{{- define "myjobbot.env" -}}
- name: MYJOBBOT_DATA_DIR
  value: /data
- name: MYJOBBOT_LOG_DIR
  value: /data/log
- name: TZ
  value: {{ .Values.timeZone | quote }}
{{- with include "myjobbot.browserUrl" . }}
- name: MYJOBBOT_BROWSER_URL
  value: {{ . | quote }}
{{- end }}
{{- with include "myjobbot.searxngUrl" . }}
- name: MYJOBBOT_SEARXNG_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.extraEnv }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{- define "myjobbot.envFrom" -}}
- secretRef:
    name: {{ include "myjobbot.secretName" . }}
{{- end }}

{{/* Volumes for a myjobbot pod: the data claim plus the optional config and resume sources. */}}
{{- define "myjobbot.volumes" -}}
- name: data
  persistentVolumeClaim:
    claimName: {{ include "myjobbot.claimName" . }}
{{- with .Values.config.existingConfigMap }}
- name: config
  configMap:
    name: {{ . }}
{{- end }}
{{- with .Values.resume.existingSecret }}
- name: resume
  secret:
    secretName: {{ . }}
{{- end }}
{{- end }}

{{/* An init container copying config.json and resume.md onto the volume, when sources are named. */}}
{{- define "myjobbot.seedContainers" -}}
{{- if or .Values.config.existingConfigMap .Values.resume.existingSecret }}
- name: seed-data
  image: {{ include "myjobbot.image" . }}
  imagePullPolicy: {{ .Values.image.pullPolicy }}
  securityContext:
    {{- toYaml .Values.containerSecurityContext | nindent 4 }}
  command: ["sh", "-c"]
  args:
    - |
      set -eu
      {{- if .Values.config.existingConfigMap }}
      cp /seed/config/{{ .Values.config.key }} /data/config.json
      {{- end }}
      {{- if .Values.resume.existingSecret }}
      cp /seed/resume/{{ .Values.resume.key }} /data/resume.md
      {{- end }}
  volumeMounts:
    - name: data
      mountPath: /data
    {{- if .Values.config.existingConfigMap }}
    - name: config
      mountPath: /seed/config
      readOnly: true
    {{- end }}
    {{- if .Values.resume.existingSecret }}
    - name: resume
      mountPath: /seed/resume
      readOnly: true
    {{- end }}
{{- end }}
{{- end }}
