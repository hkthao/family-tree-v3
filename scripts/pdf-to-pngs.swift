#!/usr/bin/env swift
//
// Render từng trang PDF thành PNG bằng CoreGraphics — không cần
// poppler/imagemagick. Dùng trong tests/videos/00-overview để chiếu
// nhiều trang sổ gia phả trong video tour.
//
// Usage:
//   swift scripts/pdf-to-pngs.swift <input.pdf> <outdir> [maxWidthPx]
//
//   - maxWidthPx mặc định 1080 (vừa khung video 1080×1920)
//   - outdir sẽ chứa page-001.png, page-002.png, ...
//
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write(
        "usage: pdf-to-pngs.swift <input.pdf> <outdir> [maxWidthPx]\n".data(using: .utf8)!)
    exit(2)
}
let inputPath = args[1]
let outDir = args[2]
let maxW: CGFloat = args.count >= 4 ? CGFloat(Int(args[3]) ?? 1080) : 1080

let inURL = URL(fileURLWithPath: inputPath)
guard let doc = CGPDFDocument(inURL as CFURL) else {
    FileHandle.standardError.write(
        "cannot open PDF: \(inputPath)\n".data(using: .utf8)!)
    exit(1)
}

try? FileManager.default.createDirectory(
    atPath: outDir, withIntermediateDirectories: true)

let n = doc.numberOfPages
let colorSpace = CGColorSpaceCreateDeviceRGB()

for i in 1...n {
    guard let page = doc.page(at: i) else { continue }
    let media = page.getBoxRect(.mediaBox)
    let scale = maxW / media.width
    let w = Int(media.width * scale)
    let h = Int(media.height * scale)
    guard let ctx = CGContext(
        data: nil,
        width: w,
        height: h,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { continue }
    // Trang PDF default màu nền đen — phủ trắng trước khi vẽ.
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    ctx.drawPDFPage(page)
    guard let image = ctx.makeImage() else { continue }
    let outPath = String(format: "\(outDir)/page-%03d.png", i)
    let outURL = URL(fileURLWithPath: outPath)
    guard let dest = CGImageDestinationCreateWithURL(
        outURL as CFURL, UTType.png.identifier as CFString, 1, nil
    ) else { continue }
    CGImageDestinationAddImage(dest, image, nil)
    if !CGImageDestinationFinalize(dest) {
        FileHandle.standardError.write(
            "failed to write \(outPath)\n".data(using: .utf8)!)
    }
}

print("\(n)")
