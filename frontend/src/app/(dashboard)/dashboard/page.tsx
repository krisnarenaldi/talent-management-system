// Dummy candidates dashboard — sesuai desain dashboard.html
// Data akan diganti dengan fetch dari API pada implementasi berikutnya

const DUMMY_CANDIDATES = [
  {
    id: 1,
    name: "Elena Rodriguez",
    position: "Senior Frontend Engineer at TechCorp",
    experience: "6 yrs",
    skills: ["React", "TypeScript"],
    status: "Actively Looking",
    statusColor: "bg-[#E6F4EA] text-[#137333]",
    avatar: null,
    initials: "ER",
  },
  {
    id: 2,
    name: "Marcus King",
    position: "Product Manager at StartupX",
    experience: "4 yrs",
    skills: ["Agile", "Jira"],
    status: "Not Looking",
    statusColor: "bg-[#FCE8E6] text-[#C5221F]",
    avatar: null,
    initials: "MK",
  },
  {
    id: 3,
    name: "David Chen",
    position: "UX Designer (Freelance)",
    experience: "8 yrs",
    skills: ["Figma", "UI/UX"],
    status: "Open to Offers",
    statusColor: "bg-[#FEF7E0] text-[#B06000]",
    avatar: null,
    initials: "DC",
  },
  {
    id: 4,
    name: "Sarah Williams",
    position: "Backend Engineer at CloudBase",
    experience: "5 yrs",
    skills: ["Python", "FastAPI"],
    status: "Actively Looking",
    statusColor: "bg-[#E6F4EA] text-[#137333]",
    avatar: null,
    initials: "SW",
  },
  {
    id: 5,
    name: "James Park",
    position: "DevOps Engineer at InfraNet",
    experience: "7 yrs",
    skills: ["Kubernetes", "Docker"],
    status: "Open to Offers",
    statusColor: "bg-[#FEF7E0] text-[#B06000]",
    avatar: null,
    initials: "JP",
  },
];

export default function DashboardPage() {
  return (
    <div className="p-container-padding">
      <div className="max-w-[1400px] mx-auto space-y-stack-md">
        {/* Search & Filter Section */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-[0px_4px_12px_rgba(9,30,66,0.08)]">
          {/* Keyword search */}
          <div className="relative mb-stack-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, role, company, or keywords..."
              className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-body-md text-on-surface placeholder:text-on-surface-variant/70"
            />
          </div>

          {/* Filters grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-stack-md">
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                Position
              </label>
              <select className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary">
                <option>All Positions</option>
                <option>Frontend Engineer</option>
                <option>Product Manager</option>
              </select>
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                Skills
              </label>
              <input
                type="text"
                placeholder="e.g. React, Python"
                className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                Experience
              </label>
              <select className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary">
                <option>Any</option>
                <option>1-3 Years</option>
                <option>3-5 Years</option>
                <option>5+ Years</option>
              </select>
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                Location
              </label>
              <input
                type="text"
                placeholder="City or Remote"
                className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-outline-variant pt-stack-sm">
            <button className="text-body-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              + More Filters
            </button>
            <div className="flex items-center gap-3">
              <button className="px-4 py-1.5 border border-outline-variant text-on-surface hover:bg-surface-container-highest rounded-md text-body-sm font-medium transition-colors">
                Reset
              </button>
              <button className="px-4 py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-md text-body-sm font-medium flex items-center gap-2 transition-colors">
                <span className="material-symbols-outlined text-base">
                  upload_file
                </span>
                Import
              </button>
              <button className="px-6 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded-md text-body-sm font-medium transition-colors shadow-sm">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0px_4px_12px_rgba(9,30,66,0.08)] overflow-hidden flex flex-col">
          {/* Table header bar */}
          <div className="p-stack-md border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <h3 className="text-headline-sm text-on-surface font-semibold">
              1,245 Candidates Found
            </h3>
            <div className="flex gap-2">
              <button className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded border border-transparent hover:border-outline-variant transition-all">
                <span className="material-symbols-outlined text-xl">
                  view_list
                </span>
              </button>
              <button className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded border border-transparent hover:border-outline-variant transition-all">
                <span className="material-symbols-outlined text-xl">
                  grid_view
                </span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-label-md text-on-surface-variant border-b border-outline-variant">
                  <th className="py-3 px-4 font-medium w-12" />
                  <th className="py-3 px-4 font-medium uppercase tracking-wider">
                    Candidate Name
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider">
                    Current Position
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider">
                    Exp.
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider">
                    Skills
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="text-body-sm divide-y divide-outline-variant">
                {DUMMY_CANDIDATES.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer"
                  >
                    {/* Avatar */}
                    <td className="py-3 px-4">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant flex items-center justify-center text-on-surface-variant text-xs font-semibold">
                        {candidate.initials}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 font-medium text-on-surface">
                      {candidate.name}
                    </td>

                    {/* Position */}
                    <td className="py-3 px-4 text-on-surface-variant">
                      {candidate.position}
                    </td>

                    {/* Experience */}
                    <td className="py-3 px-4 text-on-surface-variant">
                      {candidate.experience}
                    </td>

                    {/* Skills */}
                    <td className="py-3 px-4">
                      <div className="flex gap-1 flex-wrap">
                        {candidate.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 bg-secondary-container/20 text-secondary border border-secondary-container/30 rounded-sm text-[11px] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${candidate.statusColor}`}
                      >
                        {candidate.status}
                      </span>
                    </td>

                    {/* Actions — visible on row hover */}
                    <td className="py-3 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end gap-2">
                        <button className="text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-lg">
                            visibility
                          </span>
                        </button>
                        <button className="text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-lg">
                            edit
                          </span>
                        </button>
                        <button className="text-on-surface-variant hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-lg">
                            download
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-bright text-body-sm">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span>Show</span>
              <select className="border border-outline-variant rounded-md py-1 px-2 text-sm bg-surface">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">
                  chevron_left
                </span>
              </button>
              <button className="px-3 py-1 bg-primary text-on-primary rounded-md font-medium text-body-sm">
                1
              </button>
              <button className="px-3 py-1 text-on-surface-variant hover:bg-surface-container-low rounded-md text-body-sm">
                2
              </button>
              <button className="px-3 py-1 text-on-surface-variant hover:bg-surface-container-low rounded-md text-body-sm">
                3
              </button>
              <span className="px-2 text-on-surface-variant">...</span>
              <button className="px-3 py-1 text-on-surface-variant hover:bg-surface-container-low rounded-md text-body-sm">
                125
              </button>
              <button className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded">
                <span className="material-symbols-outlined text-lg">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
