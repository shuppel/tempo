import { Icon } from "./ui/icon";
import {
  Calendar,
  MessageCircle,
  Clock,
  CheckCircle2,
  Brain,
  FileText,
} from "lucide-react";

export function IconExamples() {
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold">Monochromatic Icon Examples</h2>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Calendar} color="default" />
          <span className="text-sm">Default</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={MessageCircle} color="primary" />
          <span className="text-sm">Primary</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Clock} color="secondary" />
          <span className="text-sm">Secondary</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={CheckCircle2} color="muted" />
          <span className="text-sm">Muted</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Brain} color="accent" />
          <span className="text-sm">Accent</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={FileText} color="default" />
          <span className="text-sm">FileText</span>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8">Icon Sizes</h2>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Calendar} size="sm" />
          <span className="text-sm">Small</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Calendar} size="md" />
          <span className="text-sm">Medium</span>
        </div>

        <div className="flex flex-col items-center gap-2 p-3 border rounded-md">
          <Icon icon={Calendar} size="lg" />
          <span className="text-sm">Large</span>
        </div>
      </div>
    </div>
  );
}
