#!/usr/bin/env python3
# DWG / DXF 파일을 ezdxf를 통해 DXF 텍스트로 변환
# stdin: base64 인코딩된 파일 바이너리
# stdout: DXF 텍스트
# stderr: 오류 메시지

import sys
import base64
import io

# Windows에서 stderr/stdout을 UTF-8로 강제 설정
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import ezdxf
    from ezdxf.addons.dwg import load as dwg_load
    from ezdxf.addons.dwg.const import DwgVersionError
except ImportError:
    sys.stderr.write("ezdxf 라이브러리가 없습니다. 다음 명령으로 설치하세요: pip install ezdxf\n")
    sys.exit(1)


def main():
    raw = sys.stdin.buffer.read().strip()
    if not raw:
        sys.stderr.write("입력 데이터가 없습니다.\n")
        sys.exit(1)

    try:
        file_bytes = base64.b64decode(raw)
    except Exception as e:
        sys.stderr.write(f"base64 디코딩 실패: {e}\n")
        sys.exit(1)

    # 매직 바이트로 DWG vs DXF 구분
    # DWG: "AC1012" ~ "AC1032" (6바이트 ASCII 헤더)
    # DXF: "  0\n" 또는 "0\n" 로 시작하는 텍스트
    header = file_bytes[:6]
    is_dwg = header[:2] == b'AC' and header[2:4].isdigit()

    doc = None

    if is_dwg:
        ver = header.decode('ascii', errors='ignore')
        supported = ['AC1012', 'AC1014', 'AC1015']
        if ver not in supported:
            # 미지원 버전 → 안내 메시지
            ver_names = {
                'AC1018': 'R2004',
                'AC1021': 'R2007',
                'AC1024': 'R2010',
                'AC1027': 'R2013',
                'AC1032': 'R2018/2019/2020',
            }
            ver_label = ver_names.get(ver, ver)
            sys.stderr.write(
                f"DWG {ver_label}({ver})는 지원되지 않습니다.\n"
                "ezdxf 내장 DWG 리더는 R13/R14/2000(AC1012~AC1015)만 지원합니다.\n"
                "해결 방법: AutoCAD에서 '다른 이름으로 저장 → DXF' 후 DXF 파일을 업로드하세요.\n"
            )
            sys.exit(1)
        try:
            doc = dwg_load(file_bytes)
        except DwgVersionError as e:
            sys.stderr.write(f"DWG 버전 오류: {e}\n")
            sys.exit(1)
        except Exception as e:
            sys.stderr.write(f"DWG 변환 실패: {e}\n")
            sys.exit(1)
    else:
        # DXF 또는 잘못된 확장자로 올라온 DXF
        try:
            text = file_bytes.decode('utf-8', errors='replace')
            doc = ezdxf.read(io.StringIO(text))
        except Exception as e:
            sys.stderr.write(f"DXF 파싱 실패: {e}\n")
            sys.exit(1)

    # Drawing → DXF 텍스트 출력
    try:
        out = io.StringIO()
        doc.write(out)
        sys.stdout.write(out.getvalue())
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"DXF 출력 실패: {e}\n")
        sys.exit(1)


if __name__ == '__main__':
    main()
