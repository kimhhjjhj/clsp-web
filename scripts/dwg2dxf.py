#!/usr/bin/env python3
# DWG 파일을 DXF로 변환하는 스크립트
# stdin에서 base64 인코딩된 DWG 바이너리를 읽고 DXF 텍스트를 stdout으로 출력

import sys
import base64
import io

try:
    import ezdxf
except ImportError:
    sys.stderr.write("Error: ezdxf library not found. Install with: pip install ezdxf\n")
    sys.exit(1)


def main():
    # stdin에서 base64 데이터 읽기
    base64_data = sys.stdin.read().strip()

    if not base64_data:
        sys.stderr.write("Error: No input data\n")
        sys.exit(1)

    try:
        # base64 디코딩
        dwg_bytes = base64.b64decode(base64_data)
        dwg_file = io.BytesIO(dwg_bytes)

        # DWG 파일 읽기
        doc = ezdxf.read(dwg_file)

        # DXF 텍스트로 변환
        dxf_file = io.StringIO()
        doc.write(dxf_file, fmt='dxf')
        dxf_text = dxf_file.getvalue()

        # stdout으로 출력
        sys.stdout.write(dxf_text)
        sys.stdout.flush()

    except ezdxf.DXFError as e:
        sys.stderr.write(f"DXF Error: {str(e)}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Error converting DWG to DXF: {str(e)}\n")
        sys.exit(1)


if __name__ == '__main__':
    main()
