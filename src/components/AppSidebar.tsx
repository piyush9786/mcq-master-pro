import { useTheme } from '@/hooks/useTheme';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, BookOpen, Timer, BarChart3, BookX, ArrowUpDown, Sun, Moon, Zap, Library, FileText } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const items = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Practice', url: '/practice', icon: BookOpen },
  { title: 'Exam', url: '/exam', icon: Timer },
  { title: 'Results', url: '/results', icon: BarChart3 },
  { title: 'Wrong Questions', url: '/wrong-questions', icon: BookX },
  { title: 'Test Papers', url: '/test-papers', icon: FileText },
  { title: 'Subjects', url: '/subjects', icon: Library },
  { title: 'Import/Export', url: '/import-export', icon: ArrowUpDown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-lg">MCQ Pro</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="p-3 mt-auto border-t border-sidebar-border">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full rounded-md p-2 text-sm hover:bg-sidebar-accent/50 text-sidebar-foreground transition-colors"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>
      </div>
    </Sidebar>
  );
}
