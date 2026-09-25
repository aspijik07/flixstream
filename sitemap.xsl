<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <title>XML Sitemap - FlixStream (500get.com)</title>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&amp;display=swap" rel="stylesheet"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
          body { background:#0b0b0b; color:#ffffff; padding:40px 20px; }
          .container { max-width:1100px; margin:0 auto; }
          .header-box { background:#121212; border:1px solid #222; border-radius:12px; padding:25px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; }
          .logo { font-size:24px; font-weight:900; color:#e50914; text-decoration:none; letter-spacing:1px; }
          .logo span { color:#ffffff; }
          .badge-count { background:#1a1a1a; border:1px solid #333; color:#46d369; font-size:12px; font-weight:800; padding:6px 14px; border-radius:20px; }
          .desc { font-size:13px; color:#888; margin-top:6px; }
          table { width:100%; border-collapse:collapse; background:#121212; border:1px solid #222; border-radius:12px; overflow:hidden; font-size:13px; }
          th { background:#181818; color:#aaa; font-weight:700; text-align:left; padding:14px 16px; border-bottom:1px solid #282828; font-size:11px; letter-spacing:0.5px; }
          td { padding:12px 16px; border-bottom:1px solid #1c1c1c; color:#bbb; }
          tr:hover td { background:#161616; }
          a { color:#ffffff; text-decoration:none; transition:color 0.2s; word-break:break-all; }
          a:hover { color:#e50914; }
          .priority-pill { background:#1e1e1e; border:1px solid #333; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; color:#46d369; }
          .freq-pill { color:#888; font-size:11px; text-transform:uppercase; font-weight:600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-box">
            <div>
              <a href="https://500get.com" class="logo">FLIX<span>STREAM</span></a>
              <p class="desc">Programmatic SEO XML Sitemap Index for Search Engine Crawlers</p>
            </div>
            <div class="badge-count">
              TOTAL URLS: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>URL LOCATION</th>
                <th>PRIORITY</th>
                <th>CHANGE FREQ</th>
                <th>LAST MODIFIED</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td style="color:#555; width:40px;"><xsl:value-of select="position()"/></td>
                  <td>
                    <a target="_blank">
                      <xsl:attribute name="href">
                        <xsl:value-of select="sitemap:loc"/>
                      </xsl:attribute>
                      <xsl:value-of select="sitemap:loc"/>
                    </a>
                  </td>
                  <td style="width:90px;">
                    <span class="priority-pill"><xsl:value-of select="sitemap:priority"/></span>
                  </td>
                  <td style="width:110px;">
                    <span class="freq-pill"><xsl:value-of select="sitemap:changefreq"/></span>
                  </td>
                  <td style="color:#777; width:110px;"><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>