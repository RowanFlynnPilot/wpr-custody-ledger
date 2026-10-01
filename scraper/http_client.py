import requests

HEADERS = {'User-Agent': 'wpr-custody-ledger (Wausau Pilot & Review; editor@wausaupilotandreview.com)'}


def head(url: str) -> requests.Response:
    response = requests.head(url, headers=HEADERS, timeout=60)
    response.raise_for_status()
    return response


def get(url: str) -> requests.Response:
    response = requests.get(url, headers=HEADERS, timeout=60)
    response.raise_for_status()
    return response
