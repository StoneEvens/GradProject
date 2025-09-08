import os
import re

def find_bad_swagger(root_dir):
    bad_files = []

    # 正則：檢查同時有 request_body 和 manual_parameters
    pattern_body = re.compile(r"request_body\s*=")
    pattern_params = re.compile(r"manual_parameters\s*=")

    for subdir, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(subdir, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "swagger_auto_schema" in content:
                        if pattern_body.search(content) and pattern_params.search(content):
                            bad_files.append(path)

    return bad_files


if __name__ == "__main__":
    project_root = "."  # 這裡換成你的 Django 專案根目錄
    result = find_bad_swagger(project_root)

    if result:
        print("⚠️ 找到同時用了 request_body 和 manual_parameters 的檔案：")
        for f in result:
            print(" -", f)
    else:
        print("✅ 沒有找到有問題的 swagger_auto_schema")
