export function formatPeriodLabel(period: string): string {
  if (!period) return "";

  const monthMap: Record<string, string> = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "Mei",
    "06": "Jun",
    "07": "Jul",
    "08": "Agu",
    "09": "Sep",
    "10": "Okt",
    "11": "Nov",
    "12": "Des",
  };

  const [year, month] = period.split("-");
  if (!year || !month) return period;

  return monthMap[month] ?? month;
}
