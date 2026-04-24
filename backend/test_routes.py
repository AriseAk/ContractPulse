import sys
import email.message

class _CGI:
    @staticmethod
    def parse_header(line):
        m = email.message.Message()
        m['content-type'] = line
        return m.get_content_type(), m.get_params() or {}

sys.modules['cgi'] = _CGI()

from main import app
print([r.rule for r in app.url_map.iter_rules()])
