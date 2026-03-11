#!/usr/bin/env python3
"""ベンチマーク用 C++ ソースファイル生成スクリプト

多数の翻訳単位を生成し、リンカに十分な負荷をかけるためのファイルを作成する。
各ファイルは関数定義・グローバル変数・他ファイルへの参照を含む。
"""

import os
import argparse
import textwrap


def generate_header(num_files: int, output_dir: str) -> None:
    """共通ヘッダファイルを生成"""
    lines = [
        "#pragma once",
        "#include <cstdint>",
        "#include <vector>",
        "#include <string>",
        "",
    ]
    for i in range(num_files):
        lines.append(f"int compute_{i}(int x);")
        lines.append(f"extern int global_var_{i};")
        lines.append(f"std::string get_name_{i}();")
    lines.append("")
    lines.append("void run_all(int n);")

    path = os.path.join(output_dir, "bench.h")
    with open(path, "w") as f:
        f.write("\n".join(lines))


def generate_source(index: int, num_files: int, output_dir: str) -> None:
    """1つのソースファイルを生成"""
    next_idx = (index + 1) % num_files
    prev_idx = (index - 1) % num_files

    code = textwrap.dedent(f"""\
        #include "bench.h"
        #include <cmath>
        #include <sstream>
        #include <algorithm>
        #include <numeric>

        int global_var_{index} = {index * 17 + 3};

        int compute_{index}(int x) {{
            int result = x * {index + 1};
            result += global_var_{prev_idx};
            for (int i = 0; i < 10; ++i) {{
                result ^= (result << 3) + {index};
            }}
            return result + compute_{next_idx}(x > 0 ? x - 1 : 0);
        }}

        std::string get_name_{index}() {{
            std::ostringstream oss;
            oss << "module_{index}_v" << global_var_{index};
            return oss.str();
        }}

        namespace detail_{index} {{
            struct Helper {{
                int data[{(index % 8) + 4}];
                double values[{(index % 6) + 2}];

                int sum() const {{
                    int s = 0;
                    for (auto d : data) s += d;
                    return s;
                }}
            }};

            template<typename T>
            T transform(T val) {{
                return val * {index + 1} + {index % 7};
            }}

            static Helper make_helper() {{
                Helper h{{}};
                for (int i = 0; i < {(index % 8) + 4}; ++i) {{
                    h.data[i] = i * {index + 1};
                }}
                return h;
            }}

            void process_{index}() {{
                auto h = make_helper();
                global_var_{index} = h.sum() + transform(global_var_{prev_idx});
            }}
        }}
    """)

    path = os.path.join(output_dir, f"module_{index:04d}.cpp")
    with open(path, "w") as f:
        f.write(code)


def generate_main(num_files: int, output_dir: str) -> None:
    """main関数を含むファイルを生成"""
    lines = [
        '#include "bench.h"',
        "#include <iostream>",
        "",
        "void run_all(int n) {",
    ]
    for i in range(num_files):
        lines.append(f"    std::cout << get_name_{i}() << \": \" << compute_{i}(n) << std::endl;")
    lines.append("}")
    lines.append("")
    lines.append("int main() {")
    lines.append("    run_all(5);")
    lines.append("    return 0;")
    lines.append("}")

    path = os.path.join(output_dir, "main.cpp")
    with open(path, "w") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="ベンチマーク用C++ソース生成")
    parser.add_argument(
        "-n", "--num-files", type=int, default=500,
        help="生成するモジュール数 (デフォルト: 500)"
    )
    parser.add_argument(
        "-o", "--output-dir", type=str, default="bench_src",
        help="出力ディレクトリ (デフォルト: bench_src)"
    )
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"ベンチマーク用ソースを生成中... (モジュール数: {args.num_files})")
    generate_header(args.num_files, args.output_dir)
    for i in range(args.num_files):
        generate_source(i, args.num_files, args.output_dir)
    generate_main(args.num_files, args.output_dir)

    total = args.num_files + 2  # modules + main + header
    print(f"生成完了: {total} ファイル -> {args.output_dir}/")


if __name__ == "__main__":
    main()
