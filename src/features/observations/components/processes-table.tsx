import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ObservationEmpty } from "@/components/observation-empty";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMemory } from "@/lib/format";
import type { Process } from "@/types";

const PAGE_SIZE = 50;
export function ProcessesTable({
  processes,
  onInspect,
}: {
  processes: Process[];
  onInspect: (process: Process) => void;
}) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(processes.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * PAGE_SIZE;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observed processes</CardTitle>
        <CardDescription>
          {processes.length} matches · sorted by current RSS · CPU is lifetime
          average.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Executable</TableHead>
              <TableHead>PID / parent</TableHead>
              <TableHead>Owner UID</TableHead>
              <TableHead>CPU avg.</TableHead>
              <TableHead>Memory RSS</TableHead>
              <TableHead>
                <span className="sr-only">Inspect</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.slice(start, start + PAGE_SIZE).map((process) => (
              <TableRow key={process.id}>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onInspect(process)}
                  >
                    {process.name}
                  </Button>
                </TableCell>
                <TableCell className="font-mono">
                  {process.pid}
                  <p className="text-xs text-muted-foreground">
                    parent {process.parent}
                  </p>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {process.uid}
                </TableCell>
                <TableCell className="font-mono">
                  {process.cpu.toFixed(1)}%
                </TableCell>
                <TableCell className="font-mono">
                  {formatMemory(process.memoryMb)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Inspect process ${process.pid}`}
                    onClick={() => onInspect(process)}
                  >
                    <ChevronRight />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!processes.length && (
          <ObservationEmpty
            title="No matching processes"
            description="Check your search or enable the process collector."
          />
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {processes.length
            ? `${start + 1}–${Math.min(start + PAGE_SIZE, processes.length)} of ${processes.length}`
            : "0 processes"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            aria-label="Previous process page"
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
            aria-label="Next process page"
          >
            Next
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
