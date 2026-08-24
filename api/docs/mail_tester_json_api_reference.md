# Mail-Tester JSON API — API Reference

> This document is derived exclusively from the supplied Mail-Tester JSON API documentation. It consolidates the documented request flow, URL format, parameters, response structure, visualization mode, field conventions, and error handling.

---

## 1. API Overview

Mail-Tester provides a JSON API for retrieving the results of an email test.

The workflow is:

```text
1. Send an email to:
   yourusername-whateveryouwant@mail-tester.com

2. Mail-Tester processes the email.

3. Request:
   https://www.mail-tester.com/yourusername-whateveryouwant?format=json

4. Receive a JSON object containing the test results.
```

The `yourusername` portion must be replaced with the user's own Mail-Tester username.

The `whateveryouwant` portion can be replaced with an arbitrary string, but it should be unique so that one test does not override another.

---

# 2. How to Use the API

## 2.1 Send the test email

First send an email to:

```text
yourusername-whateveryouwant@mail-tester.com
```

Where:

- `yourusername` = your Mail-Tester username.
- `whateveryouwant` = a unique identifier for the individual test.

Example:

```text
aaweb-pDrqwp@mail-tester.com
```

---

## 2.2 Request the JSON result

After sending the email, call:

```http
GET https://www.mail-tester.com/yourusername-whateveryouwant?format=json
```

Example:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json
```

The API returns a JSON object containing the processed email test results.

---

# 3. Endpoint

## Get Email Test Result

### Method

```http
GET
```

### URL

```text
https://www.mail-tester.com/{username}-{testIdentifier}?format=json
```

### Example

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json
```

### Path components

| Component | Required | Description |
|---|---|---|
| `username` | Yes | Your Mail-Tester username. |
| `testIdentifier` | Yes | Unique string identifying the test/email. |

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `format` | Yes | Set to `json` to receive the API result as JSON. |
| `test` | No | Limits the response to a specific main test. |
| `lang` | No | Changes the language of the returned result/messages. |

---

# 4. Request Examples

## 4.1 Basic JSON request

```http
GET https://www.mail-tester.com/aaweb-pDrqwp?format=json
```

---

## 4.2 jQuery

The documentation provides the following example using jQuery's `getJSON`:

```javascript
$.getJSON(
  "https://www.mail-tester.com/aaweb-pDrqwp?format=json",
  function(data) {
    if (data.status == false) {
      document.write(data.title);
      return;
    }

    $.each(data, function(key, value) {
      document.write(key + ": " + value + "<br/>");
    });
  }
);
```

### Error handling

The documented example checks:

```javascript
data.status == false
```

When this occurs, the example displays:

```javascript
data.title
```

as the error message.

---

# 5. Requesting Specific Tests

The API allows you to request only a specific test instead of processing/returning every available test.

Add:

```text
&test=key
```

The `key` must be replaced with one of the documented main tests.

Example:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&test=signature
```

The documentation specifically gives:

```text
test=signature
```

as an example.

The source states that there are **5 main tests** described in the structure section.

---

# 6. Language Parameter

The API supports a language parameter.

Add:

```text
&lang=fr-fr
```

Example:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&lang=fr-fr
```

This changes the language of the result.

The source provides `fr-fr` as an example but does not provide a complete list of supported language values.

---

# 7. Request Examples with Parameters

## JSON + specific test

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&test=signature
```

## JSON + language

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&lang=fr-fr
```

## JSON + specific test + language

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&test=signature&lang=fr-fr
```

---

# 8. Response Format

A successful API request returns a JSON object containing the Mail-Tester email test results.

The documentation states that the API includes everything shown on the normal Mail-Tester result page and additional information.

The source does not provide one complete static JSON example in the supplied HTML. Instead, it describes the response structure and recommends using the `dBug` format to inspect the complete returned object.

---

# 9. Main Response Structure

The documentation identifies the following top-level areas:

```text
Main object
├── messageInfo
├── spamAssassin
├── signature
├── body
├── blacklists
└── links
```

The source describes these as the main categories represented on a standard Mail-Tester result page.

---

# 10. Main Object

The main object contains the primary information about the email test.

According to the documentation, this includes information such as:

- ID of the address that received the email
- Final score
- Short comment about the result

Conceptually:

```json
{
  "id": "...",
  "score": "...",
  "comment": "...",
  "messageInfo": {},
  "spamAssassin": {},
  "signature": {},
  "body": {},
  "blacklists": {},
  "links": {}
}
```

> The exact field names and complete schema of the main object are not provided in the supplied HTML. The structure above illustrates the documented organization; it is not a complete API schema.

---

# 11. `messageInfo`

The `messageInfo` sub-object contains information about the email message itself.

The documentation specifically mentions:

- Subject
- Reception date
- Bounce address

The reception date is described as being in **MySQL date format**.

Conceptual structure:

```json
{
  "messageInfo": {
    "subject": "...",
    "receptionDate": "...",
    "bounceAddress": "..."
  }
}
```

> The source does not provide the exact field names or a complete JSON schema for `messageInfo`.

---

# 12. `spamAssassin`

The `spamAssassin` object contains information related to the SpamAssassin test.

The most notable structure is the `rule` array.

The `rule` array contains notable tests performed by SpamAssassin, including:

- Rule/code
- Score
- Suggestions

Conceptual structure:

```json
{
  "spamAssassin": {
    "rule": [
      {
        "code": "...",
        "score": "...",
        "suggestion": "..."
      }
    ]
  }
}
```

> The exact field names of individual rule objects are not fully specified by the supplied documentation.

---

# 13. `signature`

The `signature` object contains authentication-related tests.

The documentation explicitly identifies:

- SPF
- Sender ID
- DKIM
- rDNS

The object includes information such as:

- Scores
- Comments
- Suggestions
- Authentication test results

Conceptual structure:

```json
{
  "signature": {
    "spf": {},
    "senderId": {},
    "dkim": {},
    "rdns": {}
  }
}
```

> The exact field names and complete nested schema are not provided in the supplied HTML.

---

# 14. `body`

The `body` object contains multiple versions of the email and results from tests performed against the message body.

The documentation mentions:

- HTML version
- Text version
- Raw version
- HTML-to-text ratio
- Forbidden tags
- `alt` attributes

Conceptual structure:

```json
{
  "body": {
    "html": "...",
    "text": "...",
    "raw": "...",
    "textToHtmlRatio": {},
    "forbiddenTags": {},
    "altAttributes": {}
  }
}
```

> The exact field names and complete nested schema are not provided by the supplied HTML.

---

# 15. `blacklists`

The `blacklists` object contains an array of blacklist tests.

Each blacklist entry represents a blacklist that Mail-Tester tested and the corresponding result for the newsletter/email.

Conceptual structure:

```json
{
  "blacklists": [
    {
      "...": "..."
    }
  ]
}
```

The supplied documentation does not provide the complete field-level schema of individual blacklist entries.

---

# 16. `links`

The `links` section contains broken links found in the email.

Conceptual structure:

```json
{
  "links": [
    {
      "...": "..."
    }
  ]
}
```

The supplied documentation does not provide the complete field-level schema for individual link results.

---

# 17. Common Test Variables

The documentation states that the following variables will generally be found inside variables related to a test.

Examples of variables where this pattern can occur include:

```text
spf
texToHtmlRatio
blacklists
```

The common variables are:

| Variable | Description |
|---|---|
| `title` | Title summarizing the test and indicating what is good or wrong. |
| `mark` | Mark/score obtained for the specific test. It is always less than or equal to `0`. |
| `displayedMark` | Mark actually displayed by Mail-Tester. If the value is greater than or equal to zero, it is replaced by `&#10003` to display a check mark. |
| `status` | Status of the test. |
| `statusClass` | CSS class used by Mail-Tester's own design. Possible values are `failure`, `warning`, `neutral`, or `success`. |
| `description` | Short description of the test. |
| `messages` | HTML-formatted message containing suggestions about the test and its results. |

---

# 18. Common Test Object Example

A conceptual representation of the common structure is:

```json
{
  "title": "Test title",
  "mark": -1,
  "displayedMark": -1,
  "status": "...",
  "statusClass": "warning",
  "description": "Description of the test",
  "messages": "<p>Suggestions about the test...</p>"
}
```

> This is a structural illustration based on the documentation. The source does not provide a complete real JSON example for these fields.

---

# 19. `statusClass`

The documented values for `statusClass` are:

| Value | Meaning |
|---|---|
| `failure` | Test failed or indicates a problem. |
| `warning` | Test produced a warning. |
| `neutral` | Neutral result. |
| `success` | Successful result. |

These are the CSS class names used by Mail-Tester for its own design.

---

# 20. `mark` and `displayedMark`

## `mark`

The documentation states that:

```text
mark <= 0
```

The value represents the mark obtained for a specific test.

## `displayedMark`

`displayedMark` is the value that Mail-Tester actually displays.

If the value is greater than or equal to zero, Mail-Tester replaces it with:

```text
&#10003;
```

This represents a check mark in the rendered interface.

---

# 21. Error Handling

If the Mail-Tester test does not work for any reason, the API still returns a formatted object.

This applies to both:

```text
format=json
```

and:

```text
format=dbug
```

The response will contain:

```text
status = false
```

The error message is provided in:

```text
title
```

Example handling:

```javascript
$.getJSON(
  "https://www.mail-tester.com/aaweb-pDrqwp?format=json",
  function(data) {
    if (data.status == false) {
      document.write(data.title);
      return;
    }

    // Process successful response
  }
);
```

### Error response concept

```json
{
  "status": false,
  "title": "Error message"
}
```

> The exact error messages and any additional error fields are not specified by the supplied documentation.

---

# 22. dBug Visualization Mode

Mail-Tester provides a visualization format called `dbug`.

Instead of:

```text
&format=json
```

use:

```text
&format=dbug
```

Example:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=dbug
```

This provides a visual representation of the data returned for the newsletter.

---

# 23. dBug Features

The documentation describes the following capabilities:

- Visualize the complete API result.
- Inspect the returned variables.
- Expand or hide parts of the object.
- Click variable names to hide or display their contents.
- Focus on specific sections of the returned data.

For example, a variable such as:

```text
spamAssassin
```

can be clicked to hide or display that section.

---

# 24. JSON vs dBug

| Format | Parameter | Purpose |
|---|---|---|
| JSON | `format=json` | Programmatic access to the API response. |
| dBug | `format=dbug` | Human-friendly visualization of the returned object. |

### JSON

Use JSON for:

- Application integrations
- Automated processing
- Backend services
- Data extraction
- Storing results
- Building custom dashboards

### dBug

Use dBug for:

- Development
- Debugging
- Exploring the complete response
- Understanding the returned object structure

---

# 25. Recommended Integration Flow

A Mail-Tester integration can follow this flow:

```text
Generate unique test identifier
        |
        v
Send email to:
username-testIdentifier@mail-tester.com
        |
        v
Wait for Mail-Tester to process email
        |
        v
GET:
https://www.mail-tester.com/
username-testIdentifier?format=json
        |
        v
Check:
status
        |
        +---- false ---> read title
        |
        +---- true ----> process result
                          |
                          +--> Main object
                          +--> messageInfo
                          +--> spamAssassin
                          +--> signature
                          +--> body
                          +--> blacklists
                          +--> links
```

---

# 26. Specific-Test Workflow

If the application only needs one particular test:

```text
Send email
    |
    v
Request specific test
    |
    v
?format=json&test=signature
    |
    v
Process only requested result
```

Example:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&test=signature
```

This can reduce unnecessary test processing when only a particular result is required.

---

# 27. Language-Aware Workflow

To request results in a different language:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&lang=fr-fr
```

The `lang` parameter can be combined with `test`:

```text
https://www.mail-tester.com/aaweb-pDrqwp?format=json&test=signature&lang=fr-fr
```

The supplied source does not specify the complete list of supported language codes.

---

# 28. API Parameters Summary

| Parameter | Location | Required | Example | Description |
|---|---|---:|---|---|
| `username` | URL path | Yes | `aaweb` | Mail-Tester username. |
| `testIdentifier` | URL path | Yes | `pDrqwp` | Unique test identifier. |
| `format` | Query string | Yes | `json` | Response/visualization format. |
| `test` | Query string | No | `signature` | Restricts processing/result to a specific main test. |
| `lang` | Query string | No | `fr-fr` | Changes result language. |

---

# 29. Complete Endpoint Reference

## Email Test Result

```http
GET https://www.mail-tester.com/{username}-{testIdentifier}?format=json
```

### Optional query parameters

```text
test={testKey}
lang={languageCode}
```

### Full form

```text
https://www.mail-tester.com/{username}-{testIdentifier}?format=json&test={testKey}&lang={languageCode}
```

---

# 30. Complete Response Structure

The documented response organization can be represented as:

```text
Response
│
├── status
├── title
│
├── Main object
│   ├── test/address information
│   ├── final score
│   └── short comment
│
├── messageInfo
│   ├── subject
│   ├── reception date
│   └── bounce address
│
├── spamAssassin
│   └── rule[]
│       ├── code
│       ├── score
│       └── suggestions
│
├── signature
│   ├── SPF
│   ├── Sender ID
│   ├── DKIM
│   └── rDNS
│
├── body
│   ├── HTML
│   ├── Text
│   ├── Raw
│   ├── HTML-to-text ratio
│   ├── Forbidden tags
│   └── Alt attributes
│
├── blacklists
│   └── blacklist results[]
│
└── links
    └── broken links[]
```

> This diagram follows the categories and examples described in the source. The supplied documentation does not expose a formal JSON Schema with exact field names/types for every nested object.

---

# 31. Implementation Notes

## Generate unique test identifiers

The documentation explicitly recommends using a unique string for the test identifier so that one test does not override another.

Example:

```text
customer-2026-08-24-001
```

The resulting address could conceptually be:

```text
yourusername-customer-2026-08-24-001@mail-tester.com
```

## Store the test identifier

An application should retain the identifier associated with the outgoing email so it can later construct the API URL.

## Check `status`

Always check:

```text
status
```

before processing the response.

If:

```text
status == false
```

use:

```text
title
```

as the error message.

## Treat `messages` as HTML

The documentation states that:

```text
messages
```

contains an HTML-formatted message.

Applications should therefore treat it as HTML rather than assuming it is plain text.

---

# 32. Important Limitations of the Supplied Documentation

The supplied source does **not** provide:

- A formal OpenAPI specification.
- A complete JSON Schema.
- Exact data types for every nested response field.
- A complete list of supported `test` keys.
- A complete list of supported language codes.
- Authentication/API-key requirements.
- Explicit rate-limit documentation.
- HTTP status-code documentation.
- A documented POST/PUT/DELETE API.
- A documented endpoint for creating tests programmatically; the workflow begins by sending an email.
- A complete example JSON response with every field and real values.

These should not be inferred as supported API features from the supplied documentation.

---

# 33. Minimal Integration Example

```javascript
const username = "yourusername";
const testId = "unique-test-id";

const url =
  `https://www.mail-tester.com/${username}-${testId}?format=json`;

fetch(url)
  .then(response => response.json())
  .then(data => {
    if (data.status === false) {
      console.error(data.title);
      return;
    }

    console.log("Mail-Tester result:", data);
  })
  .catch(error => {
    console.error("Request failed:", error);
  });
```

> This example is an implementation pattern based on the documented GET endpoint. The supplied documentation itself provides a jQuery example rather than this Fetch implementation.

---

# 34. Domain / Email Health Use Cases

Based on the documented result categories, an application can consume Mail-Tester results for:

```text
Email Deliverability
│
├── Overall score
├── SpamAssassin
│   └── Rules and scores
│
├── Authentication
│   ├── SPF
│   ├── Sender ID
│   ├── DKIM
│   └── rDNS
│
├── Message Content
│   ├── HTML
│   ├── Text
│   ├── Raw message
│   ├── HTML-to-text ratio
│   ├── Forbidden tags
│   └── Alt attributes
│
├── Reputation
│   └── Blacklists
│
└── Links
    └── Broken links
```

This is a categorization of the documented response fields, not a separately documented Mail-Tester scoring API.

---

# 35. Final API Checklist

## Before the test

- [ ] Have a Mail-Tester username.
- [ ] Generate a unique test identifier.
- [ ] Send the email to `{username}-{testIdentifier}@mail-tester.com`.

## Retrieve results

- [ ] Call the Mail-Tester URL.
- [ ] Add `format=json`.
- [ ] Optionally add `test`.
- [ ] Optionally add `lang`.

## Process response

- [ ] Check `status`.
- [ ] If false, read `title`.
- [ ] Process the main result.
- [ ] Process `messageInfo`.
- [ ] Process `spamAssassin`.
- [ ] Process `signature`.
- [ ] Process `body`.
- [ ] Process `blacklists`.
- [ ] Process `links`.

## Development/debugging

- [ ] Replace `format=json` with `format=dbug` when inspecting the response manually.
- [ ] Use the dBug interface to expand/collapse variables.

---

# 36. Reference

This document is based exclusively on the supplied Mail-Tester JSON API HTML documentation.

Primary API endpoint:

```text
https://www.mail-tester.com/{username}-{testIdentifier}?format=json
```

Visualization endpoint:

```text
https://www.mail-tester.com/{username}-{testIdentifier}?format=dbug
```

Test filtering:

```text
&test={testKey}
```

Language selection:

```text
&lang={languageCode}
```
