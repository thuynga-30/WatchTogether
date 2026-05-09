import re
import unicodedata

def normalize_text(text):
    if not text:
        return ""

    # bỏ dấu tiếng Việt
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('utf-8')

    # lowercase
    text = text.lower()

    # bỏ ký tự đặc biệt
    text = re.sub(r"[^a-z0-9\s]", "", text)

    # bỏ khoảng trắng dư
    text = re.sub(r"\s+", " ", text).strip()

    return text