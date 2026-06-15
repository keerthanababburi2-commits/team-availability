import React, { useState, useRef } from "react";
import { 
  useListUsers, 
  useGetStats, 
  useCreateUser,
  useDeleteUser,
  useUpdateAvailability,
  getListUsersQueryKey,
  getGetStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, UserPlus, Filter, Search } from "lucide-react";

const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", 
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", 
  "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", 
  "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

function formatRelativeTime(dateString?: string) {
  if (!dateString) return "just now";
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `since ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `since ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `since ${diffDays}d ago`;
}

type FilterType = "All" | "Available" | "Unavailable";

function AvailabilityToggle({ user, updateAvailability }: { user: any, updateAvailability: any }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(user.statusNote || "");
  const isDismissing = useRef(false);

  const handleCheckedChange = (checked: boolean) => {
    if (!checked) {
      setNote(user.statusNote || "");
      isDismissing.current = false;
      setOpen(true);
    } else {
      updateAvailability.mutate({ id: user.id, data: { available: true, statusNote: null } });
      setOpen(false);
    }
  };

  const handleSave = () => {
    isDismissing.current = true;
    updateAvailability.mutate({ id: user.id, data: { available: false, statusNote: note || null } });
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (!isDismissing.current) {
        updateAvailability.mutate({ id: user.id, data: { available: false, statusNote: note || null } });
      }
      setOpen(false);
    } else {
      isDismissing.current = false;
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <Switch 
            checked={user.available}
            onCheckedChange={handleCheckedChange}
            className="data-[state=checked]:bg-emerald-500 scale-125"
            data-testid={`switch-availability-${user.id}`}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status Note</label>
          <Input 
            autoFocus
            placeholder="e.g. OOO until tomorrow" 
            value={note} 
            onChange={(e) => setNote(e.target.value)} 
            className="h-8 text-sm"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="h-8 text-xs">Set Status</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export default function Dashboard() {
  const { data: users, isLoading: loadingUsers } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const { data: stats, isLoading: loadingStats } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [filter, setFilter] = useState<FilterType>("All");
  const [search, setSearch] = useState("");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newStatusNote, setNewStatusNote] = useState("");

  const updateAvailability = useUpdateAvailability({
    mutation: {
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: getListUsersQueryKey() });
        const previousUsers = queryClient.getQueryData<any[]>(getListUsersQueryKey());
        
        if (previousUsers) {
          queryClient.setQueryData(
            getListUsersQueryKey(),
            previousUsers.map(u => 
              u.id === variables.id ? { 
                ...u, 
                available: variables.data.available, 
                statusNote: variables.data.statusNote !== undefined ? variables.data.statusNote : u.statusNote 
              } : u
            )
          );
        }
        return { previousUsers };
      },
      onError: (err, variables, context) => {
        if (context?.previousUsers) {
          queryClient.setQueryData(getListUsersQueryKey(), context.previousUsers);
        }
        toast({
          title: "Update failed",
          description: "Could not update availability. Reverting.",
          variant: "destructive"
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      }
    }
  });

  const deleteUser = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        toast({
          title: "Member removed",
          description: "Team member has been removed from the board."
        });
      }
    }
  });

  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        setIsAddOpen(false);
        setNewName("");
        setNewRole("");
        setNewDepartment("");
        setNewStatusNote("");
        toast({
          title: "Member added",
          description: "New team member is now on the board."
        });
      }
    }
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRole.trim()) return;
    
    createUser.mutate({
      data: {
        name: newName,
        role: newRole,
        department: newDepartment.trim() || undefined,
        statusNote: newStatusNote.trim() || undefined,
        available: true,
        avatarColor: getRandomColor()
      }
    });
  };

  const filteredUsers = users?.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.role.toLowerCase().includes(search.toLowerCase()) ||
                          (u.department && u.department.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;
    
    if (filter === "Available") return u.available;
    if (filter === "Unavailable") return !u.available;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Team Status</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Real-time availability tracking</p>
          </div>
          
          <div className="flex gap-4">
            <Card className="bg-white dark:bg-slate-900 border-none shadow-sm shadow-indigo-100 dark:shadow-none w-32 shrink-0">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white" data-testid="stat-total">
                  {loadingStats ? <Skeleton className="h-9 w-12 mx-auto" /> : stats?.total || 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-none shadow-sm shadow-emerald-100 dark:shadow-none w-32 shrink-0 ring-1 ring-inset ring-emerald-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1">Active</div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400" data-testid="stat-available">
                  {loadingStats ? <Skeleton className="h-9 w-12 mx-auto bg-emerald-200/50" /> : stats?.available || 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-rose-50 dark:bg-rose-950/30 border-none shadow-sm shadow-rose-100 dark:shadow-none w-32 shrink-0 ring-1 ring-inset ring-rose-500/20">
              <CardContent className="p-4 text-center">
                <div className="text-sm font-semibold text-rose-600 dark:text-rose-500 uppercase tracking-wider mb-1">Away</div>
                <div className="text-3xl font-black text-rose-700 dark:text-rose-400" data-testid="stat-unavailable">
                  {loadingStats ? <Skeleton className="h-9 w-12 mx-auto bg-rose-200/50" /> : stats?.unavailable || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex w-full sm:w-auto items-center gap-2 px-2">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <Input 
              placeholder="Search team..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 text-base px-0 h-10 w-full sm:w-64"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-2 justify-between sm:justify-end border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-4">
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
              {(["All", "Available", "Unavailable"] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    filter === f 
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                  data-testid={`filter-${f.toLowerCase()}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 rounded-lg gap-2" data-testid="button-add-member">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Member</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Add a new person to the availability board.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                    <Input id="name" placeholder="Jane Doe" value={newName} onChange={e => setNewName(e.target.value)} required data-testid="input-new-name" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="role" className="text-sm font-medium">Role / Title</label>
                    <Input id="role" placeholder="Senior Engineer" value={newRole} onChange={e => setNewRole(e.target.value)} required data-testid="input-new-role" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="department" className="text-sm font-medium">Department (Optional)</label>
                    <Input id="department" placeholder="e.g. Engineering" value={newDepartment} onChange={e => setNewDepartment(e.target.value)} data-testid="input-new-department" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="statusNote" className="text-sm font-medium">Status Note (Optional)</label>
                    <Input id="statusNote" placeholder="What are you up to?" value={newStatusNote} onChange={e => setNewStatusNote(e.target.value)} data-testid="input-new-statusNote" />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createUser.isPending} data-testid="button-submit-member">
                      {createUser.isPending ? "Adding..." : "Add to Board"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Board */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
            {loadingUsers ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No team members found</h3>
                <p>Try adjusting your search or filters.</p>
              </div>
            ) : (
              filteredUsers.map(user => (
                <div 
                  key={user.id} 
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !user.available ? "opacity-75 grayscale-[0.2]" : ""
                  }`}
                  data-testid={`row-user-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className={`w-12 h-12 border-2 ${user.available ? 'border-emerald-500' : 'border-transparent'}`}>
                      <AvatarFallback className={`text-white font-bold ${user.avatarColor || 'bg-slate-500'}`}>
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{user.name}</h3>
                        {user.available ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 px-1.5 py-0">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-1.5 py-0">
                            Away
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{user.role}</p>
                        {user.department && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-sm font-semibold opacity-80">
                            {user.department}
                          </Badge>
                        )}
                      </div>
                      {user.statusNote && (
                        <p className="text-slate-400 dark:text-slate-500 text-xs italic mt-1 max-w-[240px] truncate" title={user.statusNote}>
                          "{user.statusNote.length > 60 ? user.statusNote.substring(0, 57) + "..." : user.statusNote}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 ml-16 sm:ml-0">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold uppercase tracking-wider ${user.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {user.available ? 'Available' : 'Unavailable'}
                        </span>
                        <AvailabilityToggle user={user} updateAvailability={updateAvailability} />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
                        {formatRelativeTime(user.availabilityUpdatedAt)}
                      </span>
                    </div>
                    
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      onClick={() => {
                        if(confirm(`Remove ${user.name} from the board?`)) {
                          deleteUser.mutate({ id: user.id });
                        }
                      }}
                      data-testid={`button-delete-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

