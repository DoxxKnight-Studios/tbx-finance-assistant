import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  downloadFile,
  generateCsvData,
  generateMarkdownReport,
  generatePlainText,
} from "@/lib/exportUtils";
import type { ChatApiResult } from "@/types/chat";

interface MessageActionsProps {
  result: ChatApiResult;
}

export function MessageActions({ result }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const hasCsv = Boolean(result.evidence?.rankings && result.evidence.rankings.length > 0);

  function handleCopy() {
    const text = generatePlainText(result);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadMarkdown() {
    const md = generateMarkdownReport(result);
    downloadFile(
      `tbx-finance-${Date.now()}.md`,
      md,
      "text/markdown;charset=utf-8",
    );
  }

  function handleDownloadText() {
    const txt = generatePlainText(result);
    downloadFile(
      `tbx-finance-${Date.now()}.txt`,
      txt,
      "text/plain;charset=utf-8",
    );
  }

  function handleDownloadCsv() {
    const csv = generateCsvData(result);
    if (csv) {
      downloadFile(
        `tbx-finance-breakdown-${Date.now()}.csv`,
        csv,
        "text/csv;charset=utf-8",
      );
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 text-muted-foreground">
        {/* Copy Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Copy response"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{copied ? "Copied!" : "Copy response"}</span>
          </TooltipContent>
        </Tooltip>

        {/* Download Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Download response"
                >
                  <Download className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>Download / Export</span>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={handleDownloadMarkdown} className="cursor-pointer gap-2">
              <FileText className="size-3.5" />
              <span>Markdown (.md)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadText} className="cursor-pointer gap-2">
              <FileText className="size-3.5" />
              <span>Plain Text (.txt)</span>
            </DropdownMenuItem>
            {hasCsv && (
              <DropdownMenuItem onClick={handleDownloadCsv} className="cursor-pointer gap-2">
                <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Spreadsheet (.csv)</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
