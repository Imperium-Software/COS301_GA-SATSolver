"""
    Module: GA
    Description: Defines the genetic algorithm and all the core functionality of it, including crossover and tabu search
"""

from individual import Individual
import copy


class GA:
    def __init__(self, filename, method):
        f = open(filename, "r")
        # Read all the lines from the file that aren't comments
        lines = [line.replace("\n", "") for line in f.readlines() if line[0] != "c" and line.strip() != ""]
        (self.numberOfVariables, self.numberOfClauses) = int(lines[0].split()[2]), int(lines[0].split()[3])
        self.formula = []
        self.method = method
        # Go through the lines and create numberOfClauses clauses
        line = 1
        # for line in range(1, len(lines)):
        while line < len(lines):
            clause = []
            # We need a while loop as a clause may be split over many lines, but eventually ends with a 0
            end_of_clause = False
            while line < len(lines) and not end_of_clause:
                # Split the line and append a list of all integers, excluding 0, to clause
                clause.append([int(variable.strip()) for variable in lines[line].split() if int(variable.strip()) != 0])
                # If this line ended with a 0, we reached the end of the clause
                if int(lines[line].split()[-1].strip()) == 0:
                    end_of_clause = True
                    line += 1
                # Otherwise continue reading this clause from the next line
                else:
                    line += 1
            # clause is now a list of lists, so we need to flatten it and convert it to a list
            self.formula.append(tuple([item for sublist in clause for item in sublist]))

    def sat(self, individual, clause):

        """
        sat (X,c) - by literature
        Indicates whether the clause c is true or false for the individual X i.e. satisfied or not by the assignment
        corresponding to X.
        :param individual: Individual class (Implemented by Regan) representing a particular assignment of truth values
        to variables.
        :param clause: Python tuple of integers - should be the same tuple as in the DIMACS format.
        :return: returns a boolean value indicating whether the assignment represented by the individual satisfies the
        clause.
        """

        # Iterate over atoms in the clause
        for atom in clause:
            # IF the atom is not negated
            if atom > 0:
                if individual.get(atom):
                    # The clause is satisfiable on seeing the first true atom
                    return True
            # IF the atom is negated
            else:
                if individual.get(abs(atom)) == 0:
                    # The clause is satisfiable on seeing the first false atom due to it being a negation
                    return True
        # Clause is unsatisfiable - no true atoms
        return False

    def sat_crossover(self, individual, clause):

        """
        sat (X,c) - by literature
        Indicates whether the clause c is true or false for the individual X i.e. satisfied or not by the assignment
        corresponding to X - Particular to crossovers as it takes into account whether there are undefined variables
    used in the clause - if so, the clause is not satisfied.
        :param individual: Individual class (Implemented by Regan) representing a particular assignment of truth values
        to variables.
        :param clause: Python tuple of integers - should be the same tuple as in the DIMACS format.
        :return: returns a boolean value indicating whether the assignment represented by the individual satisfies the
        clause.
        """

        # Iterate over atoms in the clause
        for atom in clause:
            # IF the atom is not negated
            if atom > 0:
                # The Clause is unsatisfiable on seeing an undefined variable.
                if individual.get_defined(atom) is False:
                    return False
                if individual.get(atom):
                    # The clause is satisfiable on seeing the first true atom
                    return True
            # IF the atom is negated
            else:
                # The Clause is unsatisfiable on seeing an undefined variable.
                if individual.get_defined(abs(atom)) is False:
                    return False
                if individual.get(abs(atom)) == 0:
                    # The clause is satisfiable on seeing the first false atom due to it being a negation
                    return True
        # Clause is unsatisfiable - no true atoms
        return False

    def evaluate(self, individual):

        """
        The fitness of individual with respect to the formula.
        :param individual: Individual class (Implemented by Regan) representing a particular assignment of truth values
        to variables.
        :return: the number of clauses of F which are not satisfied by X.
        """

        # Keeps count of unsatisfied clauses
        num_unsatisfied_clauses = 0

        # Iterate over clauses in the formula
        for clause in self.formula:

            # If a clause is unsatisfied increase the unsatisfied counter
            if self.sat(individual, clause) == 0:
                num_unsatisfied_clauses = num_unsatisfied_clauses + 1

        return num_unsatisfied_clauses

    def improvement(self, individual, index):

        """
        The function computes the improvement (difference in unsatisfiable clauses) obtained by the flip of the ith
        variable of the individual.
        :param individual: Individual class (Implemented by Regan) representing a particular assignment of truth values
        to variables.
        :param index: index of a bit (starts at 1 - as per clause numbering in DIMACS format).
        :return: computed improvement value.
        """

        # index is not boundary tested - assuming this is done before a call to this function.

        # Determine fitness of individual before alterations
        original_individual_fitness = self.evaluate(individual)

        new_individual = copy.deepcopy(individual)
        # Flips the bit at the specified index
        new_individual.flip(index)

        # Calculates improvement in fitness
        return original_individual_fitness - self.evaluate(new_individual)

    def corrective_clause(self, X, Y):

        """
            Some docstring

        """

        Z = Individual(self.numberOfVariables, self.method, False)
        for clause in self.formula:
            best_pos = 0
            best_improvement = 0
            if not self.sat(X, clause) and not self.sat(Y, clause) and not self.sat_crossover(Z, clause):
                for i in range(len(clause)):
                    current_improvement = self.improvement(X, i) + self.improvement(Y, i)
                    if current_improvement >= best_improvement:
                        best_improvement = current_improvement
                        best_pos = i
                Z.set(best_pos, X.get(best_pos))
                Z.set_defined(best_pos)
                Z.flip(best_pos)
                Z.allocate(X, Y)
        return Z

    def corrective_clause_with_truth_maintenance(self, X, Y):

        """
            See page 9 of the paper

        """

        Z = Individual(self.numberOfVariables, self.method, False)
        for clause in self.formula:
            best_pos = 0
            maximum_improvement = self.improvement(X, 0) + self.improvement(Y, 0)
            if not self.sat(X, clause) and not self.sat(Y, clause) and not self.sat_crossover(Z, clause):
                for i in range(len(clause)):
                    current_improvement = self.improvement(X, i) + self.improvement(Y, i)
                    if current_improvement >= maximum_improvement:
                        maximum_improvement = current_improvement
                        best_pos = i
                Z.set(best_pos, X.get(best_pos))
                Z.set_defined(best_pos)
                Z.flip(best_pos)

        # Truth maintenance - See section 4.2 of the paper
        for clause in self.formula:
            best_pos = -1
            minimum_improvement = self.numberOfClauses + 1
            if self.sat(X, clause) and self.sat(Y, clause) and not self.sat_crossover(Z, clause):
                for i in range(len(clause)):
                    if X.get(i) == 1 or Y.get(i) == 1:
                        current_improvement = self.improvement(X, i) + self.improvement(Y, i)
                        z_new = copy.deepcopy(Z)
                        z_new.set(best_pos, 1)
                        z_new.set_defined(best_pos, 1)
                        if current_improvement < minimum_improvement and self.sat_crossover(z_new, clause):
                            minimum_improvement = current_improvement
                            best_pos = i
                if not best_pos == -1:
                    Z.set(best_pos, 1)
                    Z.set_defined(best_pos, 1)
        Z.allocate(X, Y)
        return Z

def fluerent_and_ferland(self, x, y):
    Z = Individual(self.numberOfVariables, self.method, False)
    for clause in self.formula:
        if (self.sat(x, clause) and not self.sat(y, clause)):
            for i in range(len(clause)):
                Z.set(i, x(i))
                Z.set_defined(i, 1)
        elif (not self.sat(x, clause) and self.sat(y, clause)):
            for i in range(len(clause)):
                Z.set(i, y(i))
                Z.set_defined(i, 1)
    Z.allocate(x,y)
    return Z

def select(self, population, number_of_individuals):
    population.sort(key=evaluate)
    sub_population = population[0:number_of_individuals]
    child_x = random.choice(sub_population)
    child_y = random.choice(sub_population)
    while child_x == child_y:
        child_x = random.choice(sub_population)

    return child_x, child_y   

if __name__ == "__main__":
    # TESTS
    num_fail = 0
    print("Testing SAT instance : f1000")
    x = GA("../examples/f1000.cnf")
    if len(x.formula) == x.numberOfClauses:
        print("    len(formula) == numberOfClauses => pass")
    else:
        print("    len(formula) == numberOfClauses => fail")
        num_fail += 1
    if x.formula[0] == (119, 325, -401):
        print("    formula[0] == (119, 325, -401) => pass")
    else:
        print("    formula[0] == (119, 325, -401) => fail")
        num_fail += 1
    if x.formula[-1] == (-839, -494, 718):
        print("    formula[-1] == (-839, -494, 718) => pass")
    else:
        print("    formula[-1] == (-839, -494, 718) => fail")
        num_fail += 1

    print()
    print("Testing SAT instance : f2000")
    x = GA("../examples/f2000.cnf")
    if len(x.formula) == x.numberOfClauses:
        print("    len(formula) == numberOfClauses => pass")
    else:
        print("    len(formula) == numberOfClauses => fail")
        num_fail += 1
    if x.formula[0] == (1295, 1303, -1372):
        print("    formula[0] == (1295, 1303, -1372) => pass")
    else:
        print("    formula[0] == (1295, 1303, -1372) => fail")
        num_fail += 1
    if x.formula[-1] == (1952, -450, 952):
        print("    formula[-1] == (1952, -450, 952) => pass")
    else:
        print("    formula[-1] == (1952, -450, 952) => fail")
        num_fail += 1

    print()
    print("Testing SAT instance : par16-4-c")
    x = GA("../examples/par16-4-c.cnf")
    if len(x.formula) == x.numberOfClauses:
        print("    len(formula) == numberOfClauses => pass")
    else:
        print("    len(formula) == numberOfClauses => fail")
        num_fail += 1
    if x.formula[0] == (-2, 1):
        print("    formula[0] == (-2, 1) => pass")
    else:
        print("    formula[0] == (-2, 1) => fail")
        num_fail += 1
    if x.formula[-1] == (132, 324, -140):
        print("    formula[-1] == (132, 324, -140) => pass")
    else:
        print("    formula[-1] == (132, 324, -140) => fail")
        num_fail += 1

    print()
    print("Testing SAT instance : par32-5")
    x = GA("../examples/par32-5.cnf")
    if len(x.formula) == x.numberOfClauses:
        print("    len(formula) == numberOfClauses => pass")
    else:
        print("    len(formula) == numberOfClauses => fail")
        num_fail += 1
    if x.formula[0] == (-1,):
        print("    formula[0] == (-1,) => pass")
    else:
        print("    formula[0] == (-1,) => fail")
        num_fail += 1
    if x.formula[-1] == (-3176,):
        print("    formula[-1] == (-3176,) => pass")
    else:
        print("    formula[-1] == (-3176,) => fail")
        num_fail += 1

    print()
    print("Testing SAT instance : par32-5-c")
    x = GA("../examples/par32-5-c.cnf")
    if len(x.formula) == x.numberOfClauses:
        print("    len(formula) == numberOfClauses => pass")
    else:
        print("    len(formula) == numberOfClauses => fail")
        num_fail += 1
    if x.formula[0] == (-2, 1):
        print("    formula[0] == (-2, 1) => pass")
    else:
        print("    formula[0] == (-2, 1) => fail")
        num_fail += 1
    if x.formula[-1] == (450, -408, 1339):
        print("    formula[-1] == (450, -408, 1339) => pass")
    else:
        print("    formula[-1] == (450, -408, 1339) => fail")
        num_fail += 1

    print("----------------------")
    if num_fail == 0:
        print("Passed all tests.")
    else:
        print(str(num_fail) + " tests failed.")