# MxToolbox API v1 — API Reference

> This document is derived from the supplied MxToolbox API HTML documentation. It consolidates the authentication requirements, endpoints, parameters, responses, command types, quotas, examples, and implementation notes.

## 1. API Overview

| Item | Value |
|---|---|
| Base URL | `https://api.mxtoolbox.com/api/v1/` |
| Protocol | HTTPS only |
| Response format | JSON |
| Authentication | `Authorization` header containing the API key as a plain UUID |
| SDK required | No |
| Main API areas | Lookup, Monitor, Usage |

### Authentication

Every authenticated request uses:

```http
Authorization: <YOUR_API_KEY>
```

The API key is a UUID and **must not** be prefixed with `Bearer`.

Example:

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/lookup/mx/yourdomain.com" \
  -H "Authorization: <YOUR_API_KEY>"
```

### Security note

The supplied source HTML contained a live-looking API key. It is intentionally not reproduced here. If that key is still active, revoke/rotate it and replace it with a new secret.

---

# 2. Quick Start

## Step 1 — Obtain an API key

Create an MxToolbox account to receive an API key.

The source documentation states that free accounts provide DNS API requests, while paid plans provide higher quotas, network lookups, and monitor access.

## Step 2 — Test a DNS lookup

The documentation provides a free DNS test endpoint that does not require an API key:

```bash
curl "https://mxtoolbox.com/api/v1/lookup/dns/example.com"
```

A JSON response containing DNS check results should be returned.

## Step 3 — Add authentication

For authenticated requests, send:

```http
Authorization: <YOUR_API_KEY>
```

No `Bearer` prefix is used.

## Step 4 — Run a blacklist check

Blacklist checks are Network Lookups and consume the `NetworkRequests` quota:

```bash
curl -X GET \
  "https://mxtoolbox.com/api/v1/lookup/blacklist/yourdomain.com" \
  -H "Authorization: <YOUR_API_KEY>"
```

## Step 5 — Query monitors

Monitor queries require a paid API key according to the supplied documentation:

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Monitor" \
  -H "Authorization: <YOUR_API_KEY>"
```

## Step 6 — Check API usage

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Usage" \
  -H "Authorization: <YOUR_API_KEY>"
```

---

# 3. Endpoint Summary

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/Lookup/{Command}/?argument={argument}` | Execute a DNS, email, network, or blacklist lookup | Required, except documented free DNS test |
| `GET` | `/Monitor?command={Command}&name={name}&tag={tag}` | Query monitor status, optionally filtered | Required |
| `GET` | `/Monitor/{MonitorUID}` | Retrieve a monitor by UID | Required |
| `GET` | `/Monitor/{MonitorUID}/Tag` | Retrieve tags for a monitor | Required |
| `GET` | `/Usage` | Retrieve current quota/usage counters | Required |

---

# 4. Lookup API

## 4.1 Description

The Lookup API allows programmatic execution of lookups available through the MxToolbox SuperTool.

It supports:

- DNS records
- SPF
- DKIM
- DMARC
- BIMI
- MTA-STS
- MX
- A / AAAA
- SOA
- PTR
- TXT
- ASN
- Blacklist checks
- HTTP / HTTPS checks
- Ping
- SMTP
- TCP
- Traceroute
- TLS reporting

## 4.2 Endpoint

```http
GET /api/v1/Lookup/{Command}/?argument={argument}
```

Full URL:

```text
https://api.mxtoolbox.com/api/v1/Lookup/{Command}/?argument={argument}
```

The supplied examples also use lowercase `/lookup/`:

```text
https://mxtoolbox.com/api/v1/lookup/dns/example.com
```

Use the endpoint form provided by the target API environment.

## 4.3 Parameters

### Path parameter

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `Command` | Path | `string` | Yes | Lookup type to perform. See the command table below. |

### Query parameters

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `argument` | Query | `string` | Yes | Domain name or IP address to look up. |
| `port` | Query | `string` | No | Port number used for applicable lookups, such as TCP. |

### Request headers

| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | UUID string | Yes | MxToolbox API key. |

## 4.4 Argument rules

Normal DNS/email lookups:

```text
argument=example.com
```

IP-based lookups:

```text
argument=192.0.2.1
```

DKIM:

```text
argument=example.com:default
```

The DKIM argument must contain both:

```text
{domain}:{selector}
```

TCP:

```text
argument=example.com&port=80
```

The source documentation states that TCP requires a port.

---

## 4.5 Lookup commands

### DNS quota — `DnsRequests`

| Command | Argument | Description |
|---|---|---|
| `a` | `domain.com` | DNS A record; resolves a hostname to its IPv4 address. |
| `aaaa` | `domain.com` | DNS AAAA record; resolves a hostname to its IPv6 address. |
| `asn` | `domain.com` or IP | Autonomous System Number lookup. |
| `bimi` | `domain.com` | Checks the BIMI DNS record. |
| `dkim` | `domain.com:selector` | DKIM key lookup. |
| `dmarc` | `domain.com` | Checks the DMARC policy record. |
| `dns` | `domain.com` | General DNS health check. |
| `mta-sts` | `domain.com` | Checks for an MTA Strict Transport Security record. |
| `mx` | `domain.com` | Returns mail exchange servers. |
| `ptr` | IP address | Reverse DNS lookup. |
| `soa` | `domain.com` | Returns primary DNS server and zone metadata. |
| `spf` | `domain.com` | Checks SPF configuration. |
| `tlsrpt` | `domain.com` | Checks for an RFC 8460 TLSRPT DNS record. |
| `txt` | `domain.com` | Returns TXT records. |

### Network quota — `NetworkRequests`

| Command | Argument | Description |
|---|---|---|
| `blacklist` | `domain.com` or IP | Checks whether a domain/IP appears on major email blacklists. |
| `http` | `domain.com` or URL | Verifies HTTP connectivity on port 80. |
| `https` | `domain.com` or URL | Verifies HTTPS connectivity and checks SSL/TLS. |
| `ping` | `domain.com` or IP | Performs an ICMP ping. |
| `smtp` | `domain.com` or IP | Tests SMTP connectivity on port 25 and validates the banner. |
| `tcp` | `domain.com` or IP + `port` | Verifies that a host accepts TCP connections. |
| `trace` | `domain.com` or IP | Performs an ICMP traceroute. |

### Complete command list

```text
a
aaaa
arin
asn
bimi
blacklist
dkim
dmarc
dns
http
https
mta-sts
mx
ping
ptr
smtp
soa
spf
tcp
tlsrpt
trace
txt
```

> Note: `arin` appears in the documented valid command list, but the supplied DNS-vs-Network command table does not provide a separate description or quota classification for it. The source should therefore be treated as authoritative that `arin` is accepted, but it does not provide enough detail here to classify its quota behavior.

---

## 4.6 Lookup request examples

### cURL

```bash
curl -X GET \
  "https://mxtoolbox.com/api/v1/lookup/dns/example.com" \
  -H "Authorization: <YOUR_API_KEY>"
```

### Python

```python
import requests

api_url = "https://mxtoolbox.com/api/v1/lookup/dns/example.com"
headers = {
    "Authorization": "<YOUR_API_KEY>"
}

response = requests.get(api_url, headers=headers)
data = response.json()
```

### JavaScript / jQuery

```javascript
var apiUrl = "https://mxtoolbox.com/api/v1/lookup/dns/example.com";
var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

---

# 5. Lookup Response

## 5.1 HTTP 200 response schema

```json
{
  "UID": "",
  "Command": "",
  "CommandArgument": "",
  "TimeRecorded": "Date",
  "ReportingNameServer": "",
  "TimeToComplete": "",
  "IsEndpoint": false,
  "HasSubscriptions": false,
  "Failed": [
    {
      "ID": 0,
      "Name": "",
      "Info": "",
      "Url": ""
    }
  ],
  "Warnings": [
    {
      "ID": 0,
      "Name": "",
      "Info": "",
      "Url": ""
    }
  ],
  "Passed": [
    {
      "ID": 0,
      "Name": "",
      "Info": "",
      "Url": ""
    }
  ],
  "Timeouts": [
    {
      "ID": 0,
      "Name": "",
      "Info": "",
      "Url": ""
    }
  ]
}
```

## 5.2 Lookup response fields

| Field | Type | Description |
|---|---|---|
| `UID` | `string` | Unique identifier for the lookup result. |
| `Command` | `string` | Command that was executed, e.g. `dns`. |
| `CommandArgument` | `string` | Domain or IP address queried. |
| `TimeRecorded` | `Date` | Timestamp when the lookup was recorded. |
| `ReportingNameServer` | `string` | DNS server that responded. |
| `TimeToComplete` | `string` | Duration of the lookup in milliseconds. |
| `IsEndpoint` | `boolean` | Whether the result is a terminal endpoint. |
| `HasSubscriptions` | `boolean` | Whether the account has active subscriptions. |
| `Failed` | `array` | Checks that failed. Each item contains `ID`, `Name`, `Info`, and `Url`. |
| `Warnings` | `array` | Checks that generated warnings. |
| `Passed` | `array` | Checks that passed. |
| `Timeouts` | `array` | Checks that timed out. |

### Check item schema

```json
{
  "ID": 0,
  "Name": "",
  "Info": "",
  "Url": ""
}
```

---

# 6. Monitor API

## 6.1 Description

The Monitor API retrieves the status of monitors configured on the MxToolbox account.

Monitor results include:

- Current status
- Failure details
- Warning details
- Monitor metadata
- Tags
- Last transition
- History URL
- Reputation information

According to the supplied documentation, monitor queries require a paid API key.

---

# 7. Query Monitor Status

## 7.1 Endpoint

```http
GET /api/v1/Monitor?command={Command}&name={name}&tag={tag}
```

All query parameters are optional.

## 7.2 Parameters

### Query parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `command` | `string` | No | Filters monitors by lookup type. Uses the Lookup API command values. |
| `name` | `string` | No | Filters by monitored domain name or IP address. |
| `tag` | `string` | No | Filters monitors by tag. |

Examples:

```text
api/v1/Monitor
```

```text
api/v1/Monitor?command=mx
```

```text
api/v1/Monitor?command=blacklist&name=192.0.2.1
```

```text
api/v1/Monitor?tag=production
```

```text
api/v1/Monitor?command=mx&name=example.com&tag=production
```

### Request header

```http
Authorization: <YOUR_API_KEY>
```

## 7.3 cURL

### All monitors

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Monitor" \
  -H "Authorization: <YOUR_API_KEY>"
```

### Filtered monitors

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Monitor?command=mx&name=example.com&tag=production" \
  -H "Authorization: <YOUR_API_KEY>"
```

## 7.4 JavaScript / jQuery

```javascript
var apiUrl = "https://api.mxtoolbox.com/api/v1/Monitor";
var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

### Filtered example

```javascript
var command = "mx";
var name = "example.com";
var tag = "production";

var apiUrl =
  "https://api.mxtoolbox.com/api/v1/Monitor?command=" +
  command +
  "&name=" +
  name +
  "&tag=" +
  tag;

var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

---

# 8. Monitor Response

## 8.1 HTTP 200 response

The endpoint returns an array of monitor objects:

```json
[
  {
    "MonitorUID": "",
    "ActionString": "",
    "LastTransition": "Date",
    "MxRep": "",
    "HistoryUrl": "",
    "Name": "",
    "TimeElapsed": "",
    "RecordCount": "",
    "LarUID": "",
    "Tags": [
      {
        "Name": "",
        "UID": "",
        "IsHidden": false,
        "IsNegative": false,
        "MonitorCount": 0
      }
    ],
    "Failing": [
      {
        "ID": 0,
        "Name": "",
        "Info": "",
        "Url": ""
      }
    ],
    "Warnings": [
      {
        "ID": 0,
        "Name": "",
        "Info": "",
        "Url": ""
      }
    ]
  }
]
```

## 8.2 Monitor fields

| Field | Type | Description |
|---|---|---|
| `MonitorUID` | `string` | Unique identifier for the monitor. |
| `ActionString` | `string` | Current status/action description, e.g. `OK` or `Failing`. |
| `LastTransition` | `Date` | Timestamp of the last status change. |
| `MxRep` | `string` | MxToolbox reputation score. |
| `HistoryUrl` | `string` | URL for the monitor's full history. |
| `Name` | `string` | Human-readable monitor name. |
| `TimeElapsed` | `string` | Time since the last check. |
| `RecordCount` | `string` | Number of records returned in the last check. |
| `LarUID` | `string` | Unique ID of the last action result. |
| `Tags` | `array` | Tag objects associated with the monitor. |
| `Failing` | `array` | Current failing checks. |
| `Warnings` | `array` | Current warning checks. |

---

# 9. Get Monitor by UID

## 9.1 Endpoint

```http
GET /api/v1/Monitor/{MonitorUID}
```

## 9.2 Description

Retrieves a monitor using its unique monitor identifier.

## 9.3 Path parameter

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `MonitorUID` | Path | `string` | Yes | UID of the monitor. |

Example:

```text
/api/v1/Monitor/123456789
```

## 9.4 cURL

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Monitor/123456789" \
  -H "Authorization: <YOUR_API_KEY>"
```

## 9.5 JavaScript / jQuery

```javascript
var apiUrl = "https://api.mxtoolbox.com/api/v1/Monitor/123456789";
var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

## 9.6 Response

The supplied documentation shows the same monitor-object array schema used by the Monitor API:

```json
[
  {
    "MonitorUID": "",
    "ActionString": "",
    "LastTransition": "Date",
    "MxRep": "",
    "HistoryUrl": "",
    "Name": "",
    "TimeElapsed": "",
    "RecordCount": "",
    "LarUID": "",
    "Tags": [
      {
        "Name": "",
        "UID": "",
        "IsHidden": false,
        "IsNegative": false,
        "MonitorCount": 0
      }
    ],
    "Failing": [
      {
        "ID": 0,
        "Name": "",
        "Info": "",
        "Url": ""
      }
    ],
    "Warnings": [
      {
        "ID": 0,
        "Name": "",
        "Info": "",
        "Url": ""
      }
    ]
  }
]
```

---

# 10. Get Tags for a Monitor

## 10.1 Endpoint

```http
GET /api/v1/Monitor/{MonitorUID}/Tag
```

## 10.2 Description

Retrieves tags associated with a specific monitor.

The `MonitorUID` can be obtained from:

```http
GET /api/v1/Monitor
```

by reading the `MonitorUID` field.

## 10.3 Path parameter

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `MonitorUID` | Path | `string` | Yes | Unique identifier of the monitor. |

## 10.4 Request header

```http
Authorization: <YOUR_API_KEY>
```

## 10.5 cURL

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Monitor/1234567890/Tag" \
  -H "Authorization: <YOUR_API_KEY>"
```

## 10.6 Python

```python
import requests

monitor_uid = "1234567890"

api_url = f"https://api.mxtoolbox.com/api/v1/Monitor/{monitor_uid}/Tag"
headers = {
    "Authorization": "<YOUR_API_KEY>"
}

response = requests.get(api_url, headers=headers)
data = response.json()
```

## 10.7 JavaScript / jQuery

```javascript
var monitorUID = "1234567890";
var apiUrl =
  "https://api.mxtoolbox.com/api/v1/Monitor/" +
  monitorUID +
  "/Tag";

var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

## 10.8 Response schema

```json
[
  {
    "Name": "",
    "UID": "",
    "IsHidden": false,
    "IsNegative": false,
    "MonitorCount": 0
  }
]
```

## 10.9 Tag fields

| Field | Type | Description |
|---|---|---|
| `Name` | `string` | Display name of the tag, e.g. `production` or `staging`. |
| `UID` | `string` | Unique identifier for the tag. |
| `IsHidden` | `boolean` | Whether the tag is hidden in the MxToolbox dashboard UI. |
| `IsNegative` | `boolean` | Whether the tag represents a negative/exclusion filter. |
| `MonitorCount` | `integer` | Number of monitors currently assigned the tag. |

---

# 11. Usage API

## 11.1 Description

The Usage API returns current API usage against the account's plan limits.

It reports:

- DNS requests consumed
- Maximum DNS requests
- Network requests consumed
- Maximum network requests

## 11.2 Endpoint

```http
GET /api/v1/Usage
```

No query or path parameters are required.

## 11.3 Request header

```http
Authorization: <YOUR_API_KEY>
```

## 11.4 cURL

```bash
curl -X GET \
  "https://api.mxtoolbox.com/api/v1/Usage" \
  -H "Authorization: <YOUR_API_KEY>"
```

## 11.5 JavaScript / jQuery

```javascript
var apiUrl = "https://api.mxtoolbox.com/api/v1/Usage";
var apiKey = "<YOUR_API_KEY>";

$.ajax({
  url: apiUrl,
  type: "GET",
  dataType: "json",
  success: function(result) {
    console.log(result);
  },
  error: function(xhr, status, error) {
    console.error(error);
  },
  beforeSend: function(xhr) {
    if (apiKey) {
      xhr.setRequestHeader("Authorization", apiKey);
    }
  }
});
```

## 11.6 Response schema

```json
{
  "DnsRequests": 0,
  "DnsMax": 0,
  "NetworkRequests": 0,
  "NetworkMax": 0
}
```

## 11.7 Response fields

| Field | Type | Description |
|---|---|---|
| `DnsRequests` | `integer` | DNS lookup requests used in the current billing period. |
| `DnsMax` | `integer` | Maximum DNS requests allowed by the current plan. |
| `NetworkRequests` | `integer` | Network requests used, such as ping or HTTP. |
| `NetworkMax` | `integer` | Maximum network requests allowed by the current plan. |

---

# 12. DNS vs Network Quotas

Every Lookup API call consumes one of two quota categories according to the source documentation.

## DNS quota

Quota field:

```text
DnsRequests
```

Commands documented under DNS:

```text
a
aaaa
asn
bimi
dkim
dmarc
dns
mta-sts
mx
ptr
soa
spf
tlsrpt
txt
```

## Network quota

Quota field:

```text
NetworkRequests
```

Commands documented under Network:

```text
blacklist
http
https
ping
smtp
tcp
trace
```

## Important special cases

### DKIM

Must use:

```text
?argument=example.com:default
```

Both domain and selector are required.

### TCP

Requires a port:

```text
?argument=example.com&port=80
```

Both the host argument and port are required.

### `arin`

The source lists `arin` as a valid Lookup command, but does not provide its description or quota classification in the supplied DNS/Network table.

---

# 13. Response Codes

| HTTP Code | Status | Meaning |
|---|---|---|
| `200` | OK | Request succeeded and the response contains the JSON result. |
| `401` | Unauthorized | API key is missing or invalid. |
| `429` | Too Many Requests | Rate limit or usage quota has been exceeded. |
| `500` | Server Error | Unexpected MxToolbox server error. |

---

# 14. Rate Limits and Quotas

The supplied documentation states that API usage is tracked against daily limits and that limits reset at:

```text
12:00 AM UTC
```

## Plan limits shown in the documentation

| Plan | DNS Requests | Network Requests | Monitor Queries |
|---|---:|---:|---|
| Free | 64 daily | 0 | — |
| Paid | Per-plan quota | Per-plan quota | Included |

The documentation also states that paid plans unlock higher request quotas, network lookups, and monitor access.

## Checking quota programmatically

Use:

```http
GET /api/v1/Usage
```

and inspect:

```json
{
  "DnsRequests": 0,
  "DnsMax": 0,
  "NetworkRequests": 0,
  "NetworkMax": 0
}
```

---

# 15. Monitor Filtering

The Monitor endpoint supports three optional filters:

```text
command
name
tag
```

They can be combined.

### All monitors

```text
GET /api/v1/Monitor
```

### By command

```text
GET /api/v1/Monitor?command=mx
```

Returns all MX monitors.

### By command and monitored name

```text
GET /api/v1/Monitor?command=blacklist&name=192.0.2.1
```

Returns the blacklist monitor for the specified IP.

### By tag

```text
GET /api/v1/Monitor?tag=production
```

Returns monitors carrying the `production` tag.

### Combined

```text
GET /api/v1/Monitor?command=mx&name=example.com&tag=production
```

Returns MX monitors for `example.com` carrying the `production` tag.

---

# 16. End-to-End Integration Flow

A typical application integration can follow this sequence:

```text
1. Store MxToolbox API key securely
        |
        v
2. Call Lookup API
        |
        v
3. Select command
   (dns / mx / spf / dmarc / blacklist / https / etc.)
        |
        v
4. Pass domain or IP as "argument"
        |
        v
5. Receive JSON result
        |
        +----> Failed
        |
        +----> Warnings
        |
        +----> Passed
        |
        +----> Timeouts
        |
        v
6. Optionally persist UID / result
        |
        v
7. For monitored resources:
   GET /Monitor
        |
        v
8. Read MonitorUID
        |
        +----> GET /Monitor/{MonitorUID}
        |
        +----> GET /Monitor/{MonitorUID}/Tag
        |
        v
9. Periodically call /Usage
        |
        v
10. Stop/throttle requests when quota is exhausted
```

---

# 17. Recommended Application-Side Handling

The supplied API documentation does not prescribe an application architecture. The following is an implementation-oriented interpretation of the documented API behavior.

## API key storage

Store the key server-side as a secret.

Do not expose it in frontend JavaScript, browser local storage, public repositories, or client-visible configuration.

Example environment variable:

```env
MXTOOLBOX_API_KEY=<YOUR_API_KEY>
```

## Request wrapper

A backend wrapper can centralize:

- Base URL
- Authorization header
- Timeout handling
- JSON parsing
- `401` handling
- `429` handling
- Logging
- Quota checks

Conceptually:

```text
MxToolboxClient
├── lookup(command, argument, port?)
├── getMonitors(filters?)
├── getMonitor(uid)
├── getMonitorTags(uid)
└── getUsage()
```

## Quota protection

Before high-volume operations, check `/Usage` and track:

```text
DnsRequests / DnsMax
NetworkRequests / NetworkMax
```

Treat `429` as a quota/rate-limit condition rather than a normal application error.

## Lookup result processing

A useful normalized internal representation is:

```json
{
  "uid": "...",
  "command": "dns",
  "argument": "example.com",
  "status": "warning",
  "failed": [],
  "warnings": [],
  "passed": [],
  "timeouts": [],
  "recordedAt": "..."
}
```

This normalized structure is an application design recommendation, not an API response defined by the source.

---

# 18. Example Domain Health Workflow

For a domain-health feature, the documented commands can be combined into a sequence such as:

```text
Domain
  |
  +--> DNS
  +--> A / AAAA
  +--> MX
  +--> SPF
  +--> DKIM
  +--> DMARC
  +--> BIMI
  +--> MTA-STS
  +--> TLSRPT
  +--> TXT
  +--> HTTP
  +--> HTTPS
  +--> Blacklist
  +--> SMTP
```

Each lookup returns its own result object. The application can then aggregate:

```text
Domain Health
├── DNS
├── Email Authentication
│   ├── SPF
│   ├── DKIM
│   └── DMARC
├── Mail Infrastructure
│   └── MX
├── Web
│   ├── HTTP
│   └── HTTPS
├── Reputation
│   └── Blacklist
└── Additional DNS Security
    ├── BIMI
    ├── MTA-STS
    └── TLSRPT
```

The source documentation itself does not define a combined "Domain Health Score"; such a score would need to be implemented by the consuming application.

---

# 19. Complete API Checklist

## Authentication

- [ ] Obtain an MxToolbox API key.
- [ ] Store it securely.
- [ ] Send it in the `Authorization` header.
- [ ] Do not prepend `Bearer`.
- [ ] Use HTTPS.

## Lookup API

- [ ] Select a valid `Command`.
- [ ] Provide `argument`.
- [ ] Provide `port` when required.
- [ ] Handle the JSON response.
- [ ] Process `Failed`, `Warnings`, `Passed`, and `Timeouts`.
- [ ] Track quota consumption.

## Monitor API

- [ ] Use a paid API key where required.
- [ ] Query all monitors or use filters.
- [ ] Read `MonitorUID`.
- [ ] Retrieve individual monitors by UID when needed.
- [ ] Retrieve monitor tags when needed.

## Usage API

- [ ] Poll `/Usage` when appropriate.
- [ ] Track `DnsRequests`.
- [ ] Track `DnsMax`.
- [ ] Track `NetworkRequests`.
- [ ] Track `NetworkMax`.
- [ ] Handle `429` responses.

---

# 20. Important Source Documentation Notes

### Free quota discrepancy

The supplied HTML contains two different values for the free DNS allowance:

- The Quickstart section says **68 DNS API requests**.
- The quota display and Rate Limits section say **64 DNS requests daily**.

Because the source is internally inconsistent, the exact free quota should be verified against the current MxToolbox account/plan rather than hard-coded from this document.

### Endpoint casing discrepancy

The documentation presents:

```text
api/v1/Lookup/{Command}/?argument={argument}
```

while examples use:

```text
api/v1/lookup/dns/example.com
```

The documented base URL is:

```text
https://api.mxtoolbox.com/api/v1/
```

Use the endpoint format confirmed by the actual API environment.

### Monitor response shape

The supplied documentation describes the `GET /Monitor/{MonitorUID}` response using the same **array of monitor objects** schema shown for the general Monitor endpoint. This document preserves that schema rather than assuming a different single-object response.

### Undocumented behavior

This source describes GET endpoints only. It does not document create/update/delete monitor endpoints, webhook configuration, pagination, or an API endpoint for creating tags. Those capabilities should not be assumed to exist based on this source alone.

---

# 21. Reference

This document is based exclusively on the supplied MxToolbox API HTML documentation and preserves the API's terminology and documented behavior.

Base URL:

```text
https://api.mxtoolbox.com/api/v1/
```

Primary endpoints:

```text
GET /Lookup/{Command}/?argument={argument}
GET /Monitor?command={Command}&name={name}&tag={tag}
GET /Monitor/{MonitorUID}
GET /Monitor/{MonitorUID}/Tag
GET /Usage
```
